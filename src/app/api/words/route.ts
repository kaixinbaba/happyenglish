import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { storyWords } from '@/storage/database/shared/schema';
import { eq, desc, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const db = await getDb();

    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'learnCount';
    const order = searchParams.get('order') || 'desc';

    // Build order clause
    const orderCol = (() => {
      switch (sort) {
        case 'lastLearnedAt':
          return storyWords.lastLearnedAt;
        case 'firstLearnedAt':
          return storyWords.firstLearnedAt;
        case 'word':
          return storyWords.word;
        case 'learnCount':
        default:
          return storyWords.learnCount;
      }
    })();

    const orderFn = order === 'asc' ? asc : desc;

    const words = await db
      .select({
        id: storyWords.id,
        word: storyWords.word,
        translation: storyWords.translation,
        learnCount: storyWords.learnCount,
        firstLearnedAt: storyWords.firstLearnedAt,
        lastLearnedAt: storyWords.lastLearnedAt,
        summary: storyWords.summary,
        sentenceHint: storyWords.sentenceHint,
        storyId: storyWords.storyId,
      })
      .from(storyWords)
      .where(eq(storyWords.userId, userId))
      .orderBy(orderFn(orderCol));

    return NextResponse.json({ words });
  } catch (error) {
    console.error('GET /api/words error:', error);
    return NextResponse.json({ error: '获取单词列表失败' }, { status: 500 });
  }
}
