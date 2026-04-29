import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { errorQuestions, storyWords, errorQuestionWordRel } from '@/storage/database/shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

const ReviewCompleteRequestSchema = z.object({
  questionId: z.string(),
  result: z.enum(['correct', 'wrong']), // 复习结果：做对了还是做错了
});

/**
 * POST /api/error-questions/review/complete
 * 提交复习结果，更新错题和单词的掌握度
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { success, data: reviewData, error } = ReviewCompleteRequestSchema.safeParse(body);
    
    if (!success) {
      return NextResponse.json({ error: '参数错误', details: error.issues }, { status: 400 });
    }

    const db = await getDb();

    // 检查错题是否存在且属于当前用户
    const existingQuestions = await db
      .select({ id: errorQuestions.id, masteryLevel: errorQuestions.masteryLevel })
      .from(errorQuestions)
      .where(and(
        eq(errorQuestions.id, reviewData.questionId),
        eq(errorQuestions.userId, userId)
      ));

    if (existingQuestions.length === 0) {
      return NextResponse.json({ error: '错题不存在' }, { status: 404 });
    }

    const currentMasteryLevel = existingQuestions[0].masteryLevel;
    let newMasteryLevel: number;

    // 根据复习结果更新掌握度
    if (reviewData.result === 'correct') {
      // 做对了，掌握度+15分，最高100分
      newMasteryLevel = Math.min(currentMasteryLevel + 15, 100);
    } else {
      // 做错了，掌握度-20分，最低0分
      newMasteryLevel = Math.max(currentMasteryLevel - 20, 0);
    }

    // 更新错题的掌握度和更新时间
    await db
      .update(errorQuestions)
      .set({
        masteryLevel: newMasteryLevel,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(errorQuestions.id, reviewData.questionId));

    // 更新关联单词的掌握度
    const relatedWordRecords = await db
      .select({ wordId: errorQuestionWordRel.wordId, masteryLevel: storyWords.masteryLevel })
      .from(errorQuestionWordRel)
      .leftJoin(storyWords, eq(errorQuestionWordRel.wordId, storyWords.id))
      .where(eq(errorQuestionWordRel.questionId, reviewData.questionId));

    for (const record of relatedWordRecords) {
      if (!record.wordId || record.masteryLevel === undefined) continue;

      let newWordMasteryLevel: number;
      if (reviewData.result === 'correct') {
        // 单词掌握度+10分
        newWordMasteryLevel = Math.min((record.masteryLevel ?? 0) + 10, 100);
      } else {
        // 单词掌握度-15分
        newWordMasteryLevel = Math.max((record.masteryLevel ?? 0) - 15, 0);
        
        // 做错的话，更新单词的错误次数和最后错误时间
        await db
          .update(storyWords)
          .set({
            errorCount: sql`${storyWords.errorCount} + 1`,
            lastErrorAt: new Date().toISOString(),
          })
          .where(eq(storyWords.id, record.wordId));
      }

      // 更新单词掌握度
      await db
        .update(storyWords)
        .set({
          masteryLevel: newWordMasteryLevel,
          lastLearnedAt: new Date().toISOString(),
        })
        .where(eq(storyWords.id, record.wordId));
    }

    return NextResponse.json({
      message: '复习结果已提交',
      newMasteryLevel,
      needReviewAgain: newMasteryLevel < 90, // 掌握度低于90分还需要继续复习
    });
  } catch (error) {
    console.error('Review complete error:', error);
    return NextResponse.json(
      { error: '提交失败，请重试' },
      { status: 500 }
    );
  }
}