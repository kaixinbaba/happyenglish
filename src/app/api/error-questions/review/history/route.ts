import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import {
  reviewSessions,
  reviewRecords,
  errorQuestions,
  errorQuestionTags,
  errorQuestionTagRel,
} from '@/storage/database/shared/schema';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { z } from 'zod';

const HistoryQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

/**
 * GET /api/error-questions/review/history
 * 获取复习历史列表
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const { success, data: query, error } = HistoryQuerySchema.safeParse(queryParams);

    if (!success) {
      return NextResponse.json({ error: '参数错误', details: error.issues }, { status: 400 });
    }

    const db = await getDb();
    const offset = (query.page - 1) * query.pageSize;

    // 获取复习会话列表
    const sessions = await db
      .select()
      .from(reviewSessions)
      .where(eq(reviewSessions.userId, userId))
      .orderBy(desc(reviewSessions.createdAt))
      .limit(query.pageSize)
      .offset(offset);

    // 获取总数
    const [countResult] = await db
      .select({ count: sql`count(*)` })
      .from(reviewSessions)
      .where(eq(reviewSessions.userId, userId));
    const total = Number(countResult?.count) || 0;
    const totalPages = Math.ceil(total / query.pageSize);

    return NextResponse.json({
      sessions,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Get review history error:', error);
    return NextResponse.json(
      { error: '获取复习历史失败，请重试' },
      { status: 500 }
    );
  }
}
