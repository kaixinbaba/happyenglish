import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { errorQuestions, errorQuestionTagRel, errorQuestionTags, storyWords } from '@/storage/database/shared/schema';
import { eq, sql, desc, and } from 'drizzle-orm';

/**
 * GET /api/error-questions/review/statistics
 * 获取错题统计数据
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const db = await getDb();

    // 1. 基础统计：总错题数、已掌握数、待复习数
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(errorQuestions)
      .where(eq(errorQuestions.userId, userId));
    const totalQuestions = totalResult.count || 0;

    const [masteredResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(errorQuestions)
      .where(and(
        eq(errorQuestions.userId, userId),
        sql`${errorQuestions.masteryLevel} >= 90`
      ));
    const masteredCount = masteredResult.count || 0;

    const [toReviewResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(errorQuestions)
      .where(and(
        eq(errorQuestions.userId, userId),
        sql`${errorQuestions.masteryLevel} < 90`
      ));
    const toReviewCount = toReviewResult.count || 0;

    const masteryRate = totalQuestions > 0 ? Math.round((masteredCount / totalQuestions) * 100) : 0;

    // 2. 题型分布统计
    const typeDistribution = await db
      .select({
        type: errorQuestions.type,
        count: sql<number>`count(*)`,
      })
      .from(errorQuestions)
      .where(eq(errorQuestions.userId, userId))
      .groupBy(errorQuestions.type);

    // 3. 高频错知识点标签TOP10
    const topTags = await db
      .select({
        tag: errorQuestionTags.tag,
        count: sql<number>`count(*)`,
      })
      .from(errorQuestionTagRel)
      .innerJoin(errorQuestionTags, eq(errorQuestionTagRel.tagId, errorQuestionTags.id))
      .innerJoin(errorQuestions, eq(errorQuestionTagRel.questionId, errorQuestions.id))
      .where(eq(errorQuestions.userId, userId))
      .groupBy(errorQuestionTags.tag)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // 4. 掌握最差的单词TOP10
    const weakestWords = await db
      .select({
        word: storyWords.word,
        translation: storyWords.translation,
        masteryLevel: storyWords.masteryLevel,
        errorCount: storyWords.errorCount,
      })
      .from(storyWords)
      .where(eq(storyWords.userId, userId))
      .orderBy(sql`${storyWords.masteryLevel} ASC`, sql`${storyWords.errorCount} DESC`)
      .limit(10);

    // 5. 近7天新增错题趋势
    const last7DaysStats = await db
      .select({
        date: sql<string>`DATE(${errorQuestions.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(errorQuestions)
      .where(and(
        eq(errorQuestions.userId, userId),
        sql`${errorQuestions.createdAt} >= NOW() - INTERVAL '7 days'`
      ))
      .groupBy(sql`DATE(${errorQuestions.createdAt})`)
      .orderBy(sql`DATE(${errorQuestions.createdAt}) ASC`);

    // 填充最近7天没有数据的日期，补0
    const last7Days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayStat = last7DaysStats.find(s => s.date === dateStr);
      last7Days.push({
        date: dateStr,
        count: dayStat?.count || 0,
      });
    }

    return NextResponse.json({
      basic: {
        totalQuestions,
        masteredCount,
        toReviewCount,
        masteryRate, // 百分比，0-100
      },
      typeDistribution,
      topTags,
      weakestWords,
      last7DaysTrend: last7Days,
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    return NextResponse.json(
      { error: '获取统计数据失败，请重试' },
      { status: 500 }
    );
  }
}
