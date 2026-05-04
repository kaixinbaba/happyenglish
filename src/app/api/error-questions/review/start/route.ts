import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import {
  errorQuestions,
  errorQuestionTagRel,
  errorQuestionTags,
  errorQuestionWordRel,
  storyWords,
  reviewSessions,
} from '@/storage/database/shared/schema';
import { eq, and, lt, inArray, desc } from 'drizzle-orm';
import { z } from 'zod';

type RelatedWord = {
  word: string | null;
  translation: string | null;
};

const StartReviewQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  tag: z.string().optional(),
  type: z.string().optional(),
});

/**
 * 三档优先级复习算法
 * 1. 最高优先级：从未复习过的题
 * 2. 中等优先级：上次答错的题
 * 3. 低优先级：上次答对的题
 * 每档内按掌握度从低到高排序
 */
const getReviewPriority = (
  masteryLevel: number,
  reviewCount: number | null | undefined,
  lastResult: string | null | undefined
) => {
  const safeReviewCount = reviewCount ?? 0;
  let priority: number;

  if (safeReviewCount === 0) {
    // 第一档：从未复习过，优先级最高
    priority = 1000 + (100 - masteryLevel);
  } else if (lastResult === 'wrong') {
    // 第二档：上次答错，优先级中等
    priority = 500 + (100 - masteryLevel);
  } else {
    // 第三档：上次答对，优先级较低
    priority = (100 - masteryLevel);
  }

  return priority;
};

/**
 * POST /api/error-questions/review/start
 * 开始新的复习会话
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const { success, data: query, error } = StartReviewQuerySchema.safeParse(queryParams);

    if (!success) {
      return NextResponse.json({ error: '参数错误', details: error.issues }, { status: 400 });
    }

    const db = await getDb();
    const whereConditions = [
      eq(errorQuestions.userId, userId),
      lt(errorQuestions.masteryLevel, 90), // 掌握度90分以上的不需要复习
    ];

    // 按题型筛选
    if (query.type) {
      whereConditions.push(eq(errorQuestions.type, query.type));
    }

    // 按标签筛选
    let questionIdsWithTag: string[] = [];
    if (query.tag) {
      const tagRecords = await db
        .select({ questionId: errorQuestionTagRel.questionId })
        .from(errorQuestionTagRel)
        .innerJoin(errorQuestionTags, eq(errorQuestionTagRel.tagId, errorQuestionTags.id))
        .where(eq(errorQuestionTags.tag, query.tag));
      questionIdsWithTag = tagRecords.map(t => t.questionId);

      if (questionIdsWithTag.length === 0) {
        return NextResponse.json({ list: [] });
      }

      whereConditions.push(inArray(errorQuestions.id, questionIdsWithTag));
    }

    // 查询所有需要复习的错题
    const questions = await db
      .select()
      .from(errorQuestions)
      .where(and(...whereConditions));

    if (questions.length === 0) {
      return NextResponse.json({ error: '没有需要复习的错题' }, { status: 400 });
    }

    // 计算每个题的复习优先级，排序
    const questionsWithPriority = questions.map(question => {
      const priority = getReviewPriority(
        question.masteryLevel,
        question.reviewCount,
        question.lastResult
      );
      return {
        ...question,
        priority,
      };
    });

    // 按优先级从高到低排序，优先级相同的按创建时间从新到旧排序
    questionsWithPriority.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // 取前limit条
    const selectedQuestions = questionsWithPriority.slice(0, query.limit);
    const questionIds = selectedQuestions.map(q => q.id);

    // 创建复习会话
    const sessionResult = await db
      .insert(reviewSessions)
      .values({
        userId,
        totalQuestions: questionIds.length,
        status: 'in_progress',
      })
      .returning({ id: reviewSessions.id });

    if (!sessionResult.length) {
      return NextResponse.json({ error: '创建复习会话失败' }, { status: 500 });
    }

    const sessionId = sessionResult[0].id;

    // 补充标签和关联单词
    let tags: Record<string, string[]> = {};
    let relatedWords: Record<string, RelatedWord[]> = {};

    if (questionIds.length > 0) {
      // 查询标签
      const tagRecords = await db
        .select({ questionId: errorQuestionTagRel.questionId, tag: errorQuestionTags.tag })
        .from(errorQuestionTagRel)
        .innerJoin(errorQuestionTags, eq(errorQuestionTagRel.tagId, errorQuestionTags.id))
        .where(inArray(errorQuestionTagRel.questionId, questionIds));

      tags = tagRecords.reduce((acc, record) => {
        if (!acc[record.questionId]) acc[record.questionId] = [];
        acc[record.questionId].push(record.tag);
        return acc;
      }, {} as Record<string, string[]>);

      // 查询关联单词
      const wordRecords = await db
        .select({ questionId: errorQuestionWordRel.questionId, word: storyWords.word, translation: storyWords.translation })
        .from(errorQuestionWordRel)
        .leftJoin(storyWords, eq(errorQuestionWordRel.wordId, storyWords.id))
        .where(inArray(errorQuestionWordRel.questionId, questionIds));

      relatedWords = wordRecords.reduce((acc, record) => {
        if (!acc[record.questionId]) acc[record.questionId] = [];
        acc[record.questionId].push({
          word: record.word,
          translation: record.translation,
        });
        return acc;
      }, {} as Record<string, RelatedWord[]>);
    }

    // 组装返回数据
    const finalQuestions = selectedQuestions.map((question, index) => ({
      ...question,
      tags: tags[question.id] || [],
      relatedWords: relatedWords[question.id] || [],
      orderIndex: index,
    }));

    return NextResponse.json({
      sessionId,
      questions: finalQuestions,
      total: questions.length,
    });
  } catch (error) {
    console.error('Start review error:', error);
    return NextResponse.json(
      { error: '开始复习失败，请重试' },
      { status: 500 }
    );
  }
}
