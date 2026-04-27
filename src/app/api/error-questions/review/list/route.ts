import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { errorQuestions, errorQuestionTags, errorQuestionWordRel, storyWords } from '@/storage/database/shared/schema';
import { eq, and, sql, desc, asc, lt } from 'drizzle-orm';
import { z } from 'zod';

const ReviewListQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20), // 一次返回多少道题
  tag: z.string().optional(), // 按知识点标签筛选
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
  const overdueDays = daysSinceError - reviewIntervalDays;
  // 优先级 = 逾期天数 * (100 - 掌握度)，掌握度越低，逾期越久，优先级越高
  return overdueDays * (100 - masteryLevel);
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

    const db = getDb();
    const whereConditions = [
      eq(errorQuestions.userId, userId),
      lt(errorQuestions.masteryLevel, 90), // 掌握度90分以上的不需要复习
    ];

    // 按标签筛选
    let questionIdsWithTag: string[] = [];
    if (query.tag) {
      const tagRecords = await db
        .select({ questionId: errorQuestionTags.questionId })
        .from(errorQuestionTags)
        .where(eq(errorQuestionTags.tag, query.tag));
      questionIdsWithTag = tagRecords.map(t => t.questionId);
      
      if (questionIdsWithTag.length === 0) {
        return NextResponse.json({ list: [] });
      }
      
      whereConditions.push(sql`${errorQuestions.id} IN ${sql.join(questionIdsWithTag, sql.raw(','))}`);
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
    let relatedWords: Record<string, string[]> = {};

    if (questionIds.length > 0) {
      // 查询标签
      const tagRecords = await db
        .select({ questionId: errorQuestionTags.questionId, tag: errorQuestionTags.tag })
        .from(errorQuestionTags)
        .where(sql`${errorQuestionTags.questionId} IN ${sql.join(questionIds, sql.raw(','))}`);
      
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
        .where(sql`${errorQuestionWordRel.questionId} IN ${sql.join(questionIds, sql.raw(','))}`);
      
      relatedWords = wordRecords.reduce((acc, record) => {
        if (!acc[record.questionId]) acc[record.questionId] = [];
        acc[record.questionId].push({
          word: record.word,
          translation: record.translation,
        });
        return acc;
      }, {} as Record<string, any[]>);
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