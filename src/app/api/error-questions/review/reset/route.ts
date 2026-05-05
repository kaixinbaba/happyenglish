import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import {
  reviewSessions,
  reviewRecords,
  errorQuestions,
} from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/error-questions/review/reset
 * 重置所有复习数据
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const db = await getDb();

    // 删除所有复习记录（会级联删除关联的 reviewRecords）
    await db.delete(reviewSessions).where(eq(reviewSessions.userId, userId));

    // 重置错题的复习状态
    await db
      .update(errorQuestions)
      .set({
        masteryLevel: 0,
        lastReviewedAt: null,
        reviewCount: 0,
        lastResult: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(errorQuestions.userId, userId));

    return NextResponse.json({ success: true, message: '复习数据已重置' });
  } catch (error) {
    console.error('Reset review data error:', error);
    return NextResponse.json(
      { error: '重置失败，请重试' },
      { status: 500 }
    );
  }
}
