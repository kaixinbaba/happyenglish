import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import {
  errorQuestions,
  errorQuestionTagRel,
  errorQuestionTags,
  errorQuestionWordRel,
  storyWords,
  reviewSessions,
  reviewRecords,
} from '@/storage/database/shared/schema';
import { eq, and, lt, inArray, desc } from 'drizzle-orm';
import { z } from 'zod';

type RelatedWord = {
  word: string | null;
  translation: string | null;
};

const ReviewListQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  tag: z.string().optional(),
  sessionId: z.string().optional(),
});

/**
 * 艾宾浩斯遗忘曲线复习间隔
 * 掌握度越低，复习间隔越短
 */
const getReviewPriority = (masteryLevel: number, lastErrorAt: string | null, createdAt: string) => {
  if (!lastErrorAt) lastErrorAt = createdAt;

  const now = Date.now();
  const errorTime = new Date(lastErrorAt).getTime();
  const daysSinceError = (now - errorTime) / (1000 * 60 * 60 * 24);

  // 根据掌握度确定应该复习的间隔天数
  let reviewIntervalDays: number;
  if (masteryLevel < 20) reviewIntervalDays = 0.25; // 6小时复习一次
  else if (masteryLevel < 40) reviewIntervalDays = 1; // 1天
  else if (masteryLevel < 60) reviewIntervalDays = 2; // 2天
  else if (masteryLevel < 80) reviewIntervalDays = 4; // 4天
  else reviewIntervalDays = 7; // 7天

  // 计算优先级：已经超过复习间隔时间越多，优先级越高
  // 即使没到复习时间，也会显示，只是优先级较低
  const overdueDays = daysSinceError - reviewIntervalDays;
  // 优先级 = 逾期天数 * (100 - 掌握度) + (100 - 掌握度)
  // 掌握度越低，优先级越高，不管是否逾期，都能出现在复习列表
  return overdueDays * (100 - masteryLevel) + (100 - masteryLevel);
};

/**
 * GET /api/error-questions/review/list
 * 获取复习任务列表，按优先级排序
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const { success, data: query, error } = ReviewListQuerySchema.safeParse(queryParams);

    if (!success) {
      return NextResponse.json({ error: '参数错误', details: error.issues }, { status: 400 });
    }

    const db = await getDb();

    // 如果有sessionId，从会话加载
    if (query.sessionId) {
      // 获取会话信息
      const sessions = await db
        .select()
        .from(reviewSessions)
        .where(and(
          eq(reviewSessions.id, query.sessionId),
          eq(reviewSessions.userId, userId)
        ));

      if (!sessions.length) {
        return NextResponse.json({ error: '复习会话不存在' }, { status: 404 });
      }

      const session = sessions[0];

      // 获取已复习的题目
      const completedRecords = await db
        .select({ questionId: reviewRecords.questionId })
        .from(reviewRecords)
        .where(eq(reviewRecords.sessionId, query.sessionId))
        .orderBy(reviewRecords.orderIndex);

      const completedQuestionIds = new Set(completedRecords.map(r => r.questionId));

      // 获取所有题目（包括已完成的）
      // 为了保持顺序，先查所有题，再重新排列
      const allRecords = await db
        .select()
        .from(reviewRecords)
        .where(eq(reviewRecords.sessionId, query.sessionId))
        .orderBy(reviewRecords.orderIndex);

      let questions: any[] = [];
      if (allRecords.length > 0) {
        // 有记录的话，从记录重建题目列表
        const recordQuestionIds = allRecords.map(r => r.questionId);
        const questionsById = new Map();

        const questionsFromDb = await db
          .select()
          .from(errorQuestions)
          .where(inArray(errorQuestions.id, recordQuestionIds));

        for (const q of questionsFromDb) {
          questionsById.set(q.id, q);
        }

        // 按照记录顺序排列
        for (const record of allRecords) {
          const q = questionsById.get(record.questionId);
          if (q) {
            questions.push({ ...q, orderIndex: record.orderIndex });
          }
        }
      } else {
        // 没有记录，可能是新会话，获取待复习的题
        const whereConditions = [
          eq(errorQuestions.userId, userId),
          lt(errorQuestions.masteryLevel, 90),
        ];

        questions = await db
          .select()
          .from(errorQuestions)
          .where(and(...whereConditions));

        // 计算优先级并排序
        questions = questions.map((q, idx) => ({
          ...q,
          priority: getReviewPriority(q.masteryLevel, q.updatedAt, q.createdAt),
          orderIndex: idx,
        })).sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }).slice(0, session.totalQuestions);
      }

      // 补充标签和关联单词
      const questionIds = questions.map(q => q.id);
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
      const finalQuestions = questions.map(question => ({
        ...question,
        tags: tags[question.id] || [],
        relatedWords: relatedWords[question.id] || [],
      }));

      return NextResponse.json({
        questions: finalQuestions,
        session: session,
        total: questions.length,
      });
    }

    // 没有sessionId，正常获取复习列表
    const whereConditions = [
      eq(errorQuestions.userId, userId),
      lt(errorQuestions.masteryLevel, 90), // 掌握度90分以上的不需要复习
    ];

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

    // 计算每个题的复习优先级，排序
    const questionsWithPriority = questions.map(question => {
      const priority = getReviewPriority(
        question.masteryLevel,
        question.updatedAt, // 最后更新时间作为最后错误时间
        question.createdAt
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
    const result = questionsWithPriority.slice(0, query.limit);

    // 补充标签和关联单词
    const questionIds = result.map(q => q.id);
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
    const finalResult = result.map(question => ({
      ...question,
      tags: tags[question.id] || [],
      relatedWords: relatedWords[question.id] || [],
    }));

    return NextResponse.json({
      list: finalResult,
      total: questions.length,
      message: questions.length === 0 ? '太棒了！你现在没有需要复习的错题' : undefined,
    });
  } catch (error) {
    console.error('Get review list error:', error);
    return NextResponse.json(
      { error: '获取复习列表失败，请重试' },
      { status: 500 }
    );
  }
}
