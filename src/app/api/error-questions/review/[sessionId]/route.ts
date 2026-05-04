import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import {
  reviewSessions,
  reviewRecords,
  errorQuestions,
  errorQuestionTags,
  errorQuestionTagRel,
} from '@/storage/database/shared/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; }> }
) {
  try {
    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { sessionId } = await params;
    const db = await getDb();

    const sessions = await db
      .select()
      .from(reviewSessions)
      .where(and(
        eq(reviewSessions.id, sessionId),
        eq(reviewSessions.userId, userId)
      ));

    if (!sessions.length) {
      return NextResponse.json({ error: '复习会话不存在' }, { status: 404 });
    }

    const session = sessions[0];

    const records = await db
      .select()
      .from(reviewRecords)
      .where(eq(reviewRecords.sessionId, sessionId))
      .orderBy(reviewRecords.orderIndex);

    const questionIds = records.map(r => r.questionId);
    let questionsById: Record<string, any> = {};

    if (questionIds.length > 0) {
      const questions = await db
        .select()
        .from(errorQuestions)
        .where(inArray(errorQuestions.id, questionIds));

      const tagRecords = await db
        .select({ questionId: errorQuestionTagRel.questionId, tag: errorQuestionTags.tag })
        .from(errorQuestionTagRel)
        .innerJoin(errorQuestionTags, eq(errorQuestionTagRel.tagId, errorQuestionTags.id))
        .where(inArray(errorQuestionTagRel.questionId, questionIds));

      const tagsByQuestion = tagRecords.reduce((acc, record) => {
        if (!acc[record.questionId]) acc[record.questionId] = [];
        acc[record.questionId].push(record.tag);
        return acc;
      }, {} as Record<string, string[]>);

      for (const q of questions) {
        questionsById[q.id] = {
          ...q,
          tags: tagsByQuestion[q.id] || [],
        };
      }
    }

    const recordsWithQuestions = records.map(record => ({
      ...record,
      question: questionsById[record.questionId] || null,
    }));

    return NextResponse.json({
      session,
      records: recordsWithQuestions,
    });
  } catch (error) {
    console.error('Get review session error:', error);
    return NextResponse.json(
      { error: '获取复习会话失败，请重试' },
      { status: 500 }
    );
  }
}
