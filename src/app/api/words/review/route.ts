import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { storyWords, storyImages } from '@/storage/database/shared/schema';
import { eq, and, isNotNull, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const db = await getDb();

    const words = await db
      .select({
        id: storyWords.id,
        word: storyWords.word,
        translation: storyWords.translation,
        summary: storyWords.summary,
        sentenceHint: storyWords.sentenceHint,
        learnCount: storyWords.learnCount,
        storyId: storyWords.storyId,
        imageUrl: storyImages.imageUrl,
      })
      .from(storyWords)
      .leftJoin(
        storyImages,
        and(
          eq(storyWords.storyId, storyImages.storyId),
          eq(storyImages.orderIndex, 0)
        )
      )
      .where(
        and(
          eq(storyWords.userId, userId),
          isNotNull(storyWords.storyId)
        )
      )
      .orderBy(desc(storyWords.learnCount));

    // Transform to nested structure
    const result = words.map(w => ({
      id: w.id,
      word: w.word,
      translation: w.translation,
      summary: w.summary,
      sentenceHint: w.sentenceHint,
      learnCount: w.learnCount,
      story: w.storyId ? {
        id: w.storyId,
        imageUrl: w.imageUrl,
      } : null,
    }));

    return NextResponse.json({ words: result });
  } catch (error) {
    console.error('GET /api/words/review error:', error);
    return NextResponse.json({ error: '获取复习列表失败' }, { status: 500 });
  }
}
