import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import {
  errorQuestions,
  errorQuestionTagRel,
  errorQuestionTags,
  reviewRecords,
  reviewSessions,
  storyWords,
} from '@/storage/database/shared/schema';
import { eq, sql, desc, and } from 'drizzle-orm';

function toNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

function round(value: number, precision = 0) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function getDateKey(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() - offsetDays);
  return date.toISOString().split('T')[0];
}

function formatDateKey(date: Date) {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseDateParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveReviewDetailRange(searchParams: URLSearchParams) {
  const requestedRange = searchParams.get('range');
  const explicitStartDate = parseDateParam(searchParams.get('startDate'));
  const explicitEndDate = parseDateParam(searchParams.get('endDate'));
  const today = new Date();
  const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  if (explicitStartDate || explicitEndDate || requestedRange === 'custom') {
    if (!explicitStartDate || !explicitEndDate) {
      return {
        error: '自定义时间范围需要同时提供 startDate 和 endDate，格式为 YYYY-MM-DD',
      };
    }

    if (explicitStartDate > explicitEndDate) {
      return {
        error: 'startDate 不能晚于 endDate',
      };
    }

    return {
      preset: 'custom',
      startDate: explicitStartDate,
      endDate: explicitEndDate,
      endExclusiveDate: addDays(explicitEndDate, 1),
    };
  }

  if (requestedRange === 'week') {
    const startDate = addDays(todayDate, -6);
    return {
      preset: 'week',
      startDate,
      endDate: todayDate,
      endExclusiveDate: addDays(todayDate, 1),
    };
  }

  const startDate = addDays(todayDate, -29);
  return {
    preset: 'month',
    startDate,
    endDate: todayDate,
    endExclusiveDate: addDays(todayDate, 1),
  };
}

function eachDateInRange(startDate: Date, endDate: Date) {
  const dates: string[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    dates.push(formatDateKey(date));
  }
  return dates;
}

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

    const startedAt = Date.now();
    const detailRange = resolveReviewDetailRange(request.nextUrl.searchParams);
    if ('error' in detailRange) {
      return NextResponse.json({ error: detailRange.error }, { status: 400 });
    }

    const [
      basicResult,
      typeDistribution,
      topTags,
      weakestWords,
      last7DaysStats,
      reviewSummaryResult,
      last30DaysReviewStats,
      masteryDistributionStats,
      reviewSessionStatsResult,
      recentAccuracyStats,
      rangeReviewSummaryResult,
      rangeDailyStats,
      rangeSessionStats,
    ] = await Promise.all([
      db
        .select({
          totalQuestions: sql<number>`count(*)`,
          masteredCount: sql<number>`count(*) filter (where ${errorQuestions.masteryLevel} >= 60)`,
          toReviewCount: sql<number>`count(*) filter (where ${errorQuestions.masteryLevel} < 60)`,
        })
        .from(errorQuestions)
        .where(eq(errorQuestions.userId, userId)),

      // 题型分布统计
      db
        .select({
          type: errorQuestions.type,
          count: sql<number>`count(*)`,
        })
        .from(errorQuestions)
        .where(eq(errorQuestions.userId, userId))
        .groupBy(errorQuestions.type),

      // 高频错知识点标签TOP10
      db
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
        .limit(10),

      // 掌握最差的单词TOP10
      db
        .select({
          word: storyWords.word,
          translation: storyWords.translation,
          masteryLevel: storyWords.masteryLevel,
          errorCount: storyWords.errorCount,
        })
        .from(storyWords)
        .where(eq(storyWords.userId, userId))
        .orderBy(sql`${storyWords.masteryLevel} ASC`, sql`${storyWords.errorCount} DESC`)
        .limit(10),

      // 近7天新增错题趋势
      db
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
        .orderBy(sql`DATE(${errorQuestions.createdAt}) ASC`),

      // 复习记录累计统计
      db
        .select({
          totalReviewRecords: sql<number>`count(*)`,
          totalCorrect: sql<number>`count(*) filter (where ${reviewRecords.result} = 'correct')`,
          totalWrong: sql<number>`count(*) filter (where ${reviewRecords.result} = 'wrong')`,
          averageMasteryImprovement: sql<number>`coalesce(avg(${reviewRecords.newMasteryLevel} - ${reviewRecords.previousMasteryLevel}), 0)`,
        })
        .from(reviewRecords)
        .where(eq(reviewRecords.userId, userId)),

      // 近30天复习趋势：每日复习题数、正确率、掌握度提升
      db
        .select({
          date: sql<string>`DATE(${reviewRecords.createdAt})`,
          reviewCount: sql<number>`count(*)`,
          correctCount: sql<number>`count(*) filter (where ${reviewRecords.result} = 'correct')`,
          wrongCount: sql<number>`count(*) filter (where ${reviewRecords.result} = 'wrong')`,
          averageMasteryImprovement: sql<number>`coalesce(avg(${reviewRecords.newMasteryLevel} - ${reviewRecords.previousMasteryLevel}), 0)`,
        })
        .from(reviewRecords)
        .where(and(
          eq(reviewRecords.userId, userId),
          sql`${reviewRecords.createdAt} >= NOW() - INTERVAL '30 days'`
        ))
        .groupBy(sql`DATE(${reviewRecords.createdAt})`)
        .orderBy(sql`DATE(${reviewRecords.createdAt}) ASC`),

      // 错题掌握度分布
      db
        .select({
          range: sql<string>`case
            when ${errorQuestions.masteryLevel} < 20 then '0-20'
            when ${errorQuestions.masteryLevel} < 40 then '20-40'
            when ${errorQuestions.masteryLevel} < 60 then '40-60'
            when ${errorQuestions.masteryLevel} < 80 then '60-80'
            else '80-100'
          end`,
          count: sql<number>`count(*)`,
        })
        .from(errorQuestions)
        .where(eq(errorQuestions.userId, userId))
        .groupBy(sql`case
          when ${errorQuestions.masteryLevel} < 20 then '0-20'
          when ${errorQuestions.masteryLevel} < 40 then '20-40'
          when ${errorQuestions.masteryLevel} < 60 then '40-60'
          when ${errorQuestions.masteryLevel} < 80 then '60-80'
          else '80-100'
        end`),

      // 复习会话统计
      db
        .select({
          totalSessions: sql<number>`count(*)`,
          completedSessions: sql<number>`count(*) filter (where ${reviewSessions.status} = 'completed')`,
          averageQuestionsPerSession: sql<number>`coalesce(avg(${reviewSessions.completedQuestions}), 0)`,
          averageCorrectRate: sql<number>`coalesce(avg(case
            when ${reviewSessions.completedQuestions} > 0
              then (${reviewSessions.correctCount}::float / ${reviewSessions.completedQuestions}) * 100
            else null
          end), 0)`,
        })
        .from(reviewSessions)
        .where(eq(reviewSessions.userId, userId)),

      // 最近30次复习会话正确率变化趋势
      db
        .select({
          sessionId: reviewSessions.id,
          date: sql<string>`DATE(coalesce(${reviewSessions.completedAt}, ${reviewSessions.updatedAt}))`,
          completedQuestions: reviewSessions.completedQuestions,
          correctCount: reviewSessions.correctCount,
          wrongCount: reviewSessions.wrongCount,
          correctRate: sql<number>`case
            when ${reviewSessions.completedQuestions} > 0
              then round(((${reviewSessions.correctCount}::numeric / ${reviewSessions.completedQuestions}) * 100), 1)
            else 0
          end`,
        })
        .from(reviewSessions)
        .where(and(
          eq(reviewSessions.userId, userId),
          sql`${reviewSessions.completedQuestions} > 0`
        ))
        .orderBy(sql`coalesce(${reviewSessions.completedAt}, ${reviewSessions.updatedAt}) DESC`)
        .limit(30),

      // 指定时间范围内的复习汇总
      db
        .select({
          totalReviewRecords: sql<number>`count(*)`,
          totalCorrect: sql<number>`count(*) filter (where ${reviewRecords.result} = 'correct')`,
          totalWrong: sql<number>`count(*) filter (where ${reviewRecords.result} = 'wrong')`,
          averageMasteryImprovement: sql<number>`coalesce(avg(${reviewRecords.newMasteryLevel} - ${reviewRecords.previousMasteryLevel}), 0)`,
        })
        .from(reviewRecords)
        .where(and(
          eq(reviewRecords.userId, userId),
          sql`${reviewRecords.createdAt} >= ${formatDateKey(detailRange.startDate)}::date`,
          sql`${reviewRecords.createdAt} < ${formatDateKey(detailRange.endExclusiveDate)}::date`
        )),

      // 指定时间范围内的每日复习趋势
      db
        .select({
          date: sql<string>`DATE(${reviewRecords.createdAt})`,
          reviewCount: sql<number>`count(*)`,
          correctCount: sql<number>`count(*) filter (where ${reviewRecords.result} = 'correct')`,
          wrongCount: sql<number>`count(*) filter (where ${reviewRecords.result} = 'wrong')`,
          averageMasteryImprovement: sql<number>`coalesce(avg(${reviewRecords.newMasteryLevel} - ${reviewRecords.previousMasteryLevel}), 0)`,
        })
        .from(reviewRecords)
        .where(and(
          eq(reviewRecords.userId, userId),
          sql`${reviewRecords.createdAt} >= ${formatDateKey(detailRange.startDate)}::date`,
          sql`${reviewRecords.createdAt} < ${formatDateKey(detailRange.endExclusiveDate)}::date`
        ))
        .groupBy(sql`DATE(${reviewRecords.createdAt})`)
        .orderBy(sql`DATE(${reviewRecords.createdAt}) ASC`),

      // 指定时间范围内的复习会话详情
      db
        .select({
          sessionId: reviewSessions.id,
          date: sql<string>`DATE(${reviewSessions.startedAt})`,
          status: reviewSessions.status,
          totalQuestions: reviewSessions.totalQuestions,
          completedQuestions: reviewSessions.completedQuestions,
          correctCount: reviewSessions.correctCount,
          wrongCount: reviewSessions.wrongCount,
          correctRate: sql<number>`case
            when ${reviewSessions.completedQuestions} > 0
              then round(((${reviewSessions.correctCount}::numeric / ${reviewSessions.completedQuestions}) * 100), 1)
            else 0
          end`,
          startedAt: reviewSessions.startedAt,
          completedAt: reviewSessions.completedAt,
        })
        .from(reviewSessions)
        .where(and(
          eq(reviewSessions.userId, userId),
          sql`${reviewSessions.startedAt} >= ${formatDateKey(detailRange.startDate)}::date`,
          sql`${reviewSessions.startedAt} < ${formatDateKey(detailRange.endExclusiveDate)}::date`
        ))
        .orderBy(desc(reviewSessions.startedAt)),
    ]);

    const basic = basicResult[0];
    const totalQuestions = toNumber(basic?.totalQuestions);
    const masteredCount = toNumber(basic?.masteredCount);
    const toReviewCount = toNumber(basic?.toReviewCount);
    const masteryRate = totalQuestions > 0 ? Math.round((masteredCount / totalQuestions) * 100) : 0;

    // 填充最近7天没有数据的日期，补0
    const last7Days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = getDateKey(i);
      const dayStat = last7DaysStats.find(s => s.date === dateStr);
      last7Days.push({
        date: dateStr,
        count: toNumber(dayStat?.count),
      });
    }

    const last30DaysReviewTrend = [];
    for (let i = 29; i >= 0; i--) {
      const dateStr = getDateKey(i);
      const dayStat = last30DaysReviewStats.find(s => s.date === dateStr);
      const reviewCount = toNumber(dayStat?.reviewCount);
      const correctCount = toNumber(dayStat?.correctCount);

      last30DaysReviewTrend.push({
        date: dateStr,
        reviewCount,
        correctCount,
        wrongCount: toNumber(dayStat?.wrongCount),
        correctRate: reviewCount > 0 ? round((correctCount / reviewCount) * 100, 1) : 0,
        averageMasteryImprovement: round(toNumber(dayStat?.averageMasteryImprovement), 1),
      });
    }

    const masteryRangeMeta = [
      { range: '0-20', label: '需重点复习', min: 0, max: 20 },
      { range: '20-40', label: '需要加强', min: 20, max: 40 },
      { range: '40-60', label: '基本掌握', min: 40, max: 60 },
      { range: '60-80', label: '掌握良好', min: 60, max: 80 },
      { range: '80-100', label: '完全掌握', min: 80, max: 100 },
    ];

    const masteryDistribution = masteryRangeMeta.map((range) => {
      const stat = masteryDistributionStats.find(item => item.range === range.range);
      return {
        ...range,
        count: toNumber(stat?.count),
      };
    });

    const reviewSummary = reviewSummaryResult[0];
    const totalReviewRecords = toNumber(reviewSummary?.totalReviewRecords);
    const totalCorrect = toNumber(reviewSummary?.totalCorrect);
    const totalWrong = toNumber(reviewSummary?.totalWrong);

    const reviewSessionStats = reviewSessionStatsResult[0];
    const rangeReviewSummary = rangeReviewSummaryResult[0];
    const rangeTotalReviewRecords = toNumber(rangeReviewSummary?.totalReviewRecords);
    const rangeTotalCorrect = toNumber(rangeReviewSummary?.totalCorrect);

    const rangeDailyTrend = eachDateInRange(detailRange.startDate, detailRange.endDate).map((date) => {
      const dayStat = rangeDailyStats.find(s => s.date === date);
      const reviewCount = toNumber(dayStat?.reviewCount);
      const correctCount = toNumber(dayStat?.correctCount);

      return {
        date,
        reviewCount,
        correctCount,
        wrongCount: toNumber(dayStat?.wrongCount),
        correctRate: reviewCount > 0 ? round((correctCount / reviewCount) * 100, 1) : 0,
        averageMasteryImprovement: round(toNumber(dayStat?.averageMasteryImprovement), 1),
      };
    });

    const durationMs = Date.now() - startedAt;
    if (durationMs > 500) {
      console.warn('Get statistics slow query:', { userId, durationMs });
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
      reviewSummary: {
        totalReviewRecords,
        totalCorrect,
        totalWrong,
        cumulativeCorrectRate: totalReviewRecords > 0 ? round((totalCorrect / totalReviewRecords) * 100, 1) : 0,
        averageMasteryImprovement: round(toNumber(reviewSummary?.averageMasteryImprovement), 1),
      },
      last30DaysReviewTrend,
      masteryDistribution,
      reviewSessionStats: {
        totalSessions: toNumber(reviewSessionStats?.totalSessions),
        completedSessions: toNumber(reviewSessionStats?.completedSessions),
        averageQuestionsPerSession: round(toNumber(reviewSessionStats?.averageQuestionsPerSession), 1),
        averageCorrectRate: round(toNumber(reviewSessionStats?.averageCorrectRate), 1),
      },
      recentAccuracyTrend: recentAccuracyStats.reverse().map((session, index) => ({
        sessionId: session.sessionId,
        index: index + 1,
        date: session.date,
        completedQuestions: toNumber(session.completedQuestions),
        correctCount: toNumber(session.correctCount),
        wrongCount: toNumber(session.wrongCount),
        correctRate: toNumber(session.correctRate),
      })),
      reviewDetail: {
        range: {
          preset: detailRange.preset,
          startDate: formatDateKey(detailRange.startDate),
          endDate: formatDateKey(detailRange.endDate),
        },
        summary: {
          totalReviewRecords: rangeTotalReviewRecords,
          totalCorrect: rangeTotalCorrect,
          totalWrong: toNumber(rangeReviewSummary?.totalWrong),
          cumulativeCorrectRate: rangeTotalReviewRecords > 0 ? round((rangeTotalCorrect / rangeTotalReviewRecords) * 100, 1) : 0,
          averageMasteryImprovement: round(toNumber(rangeReviewSummary?.averageMasteryImprovement), 1),
        },
        dailyTrend: rangeDailyTrend,
        sessions: rangeSessionStats.map(session => ({
          sessionId: session.sessionId,
          date: session.date,
          status: session.status,
          totalQuestions: toNumber(session.totalQuestions),
          completedQuestions: toNumber(session.completedQuestions),
          correctCount: toNumber(session.correctCount),
          wrongCount: toNumber(session.wrongCount),
          correctRate: toNumber(session.correctRate),
          startedAt: session.startedAt,
          completedAt: session.completedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    return NextResponse.json(
      { error: '获取统计数据失败，请重试' },
      { status: 500 }
    );
  }
}
