import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { errorQuestions, errorQuestionTags, errorQuestionWordRel, storyWords } from '@/storage/database/shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { CreateQuestionSchema } from '../route';

// 更新错题请求校验，和创建类似但所有字段都是可选
const UpdateQuestionSchema = CreateQuestionSchema.partial();

/**
 * GET /api/error-questions/[id]
 * 获取单条错题详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();

    // 查询错题
    const questions = await db
      .select()
      .from(errorQuestions)
      .where(and(
        eq(errorQuestions.id, id),
        eq(errorQuestions.userId, userId)
      ));

    if (questions.length === 0) {
      return NextResponse.json({ error: '错题不存在' }, { status: 404 });
    }

    const question = questions[0];

    // 查询标签
    const tagRecords = await db
      .select({ tag: errorQuestionTags.tag })
      .from(errorQuestionTags)
      .where(eq(errorQuestionTags.questionId, id));
    const tags = tagRecords.map(t => t.tag);

    // 查询关联单词
    const wordRecords = await db
      .select({ word: storyWords.word, translation: storyWords.translation, masteryLevel: storyWords.masteryLevel })
      .from(errorQuestionWordRel)
      .leftJoin(storyWords, eq(errorQuestionWordRel.wordId, storyWords.id))
      .where(eq(errorQuestionWordRel.questionId, id));
    const relatedWords = wordRecords.map(w => ({
      word: w.word,
      translation: w.translation,
      masteryLevel: w.masteryLevel,
    }));

    return NextResponse.json({
      ...question,
      tags,
      relatedWords,
    });
  } catch (error) {
    console.error('Get error question detail error:', error);
    return NextResponse.json(
      { error: '获取详情失败，请重试' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/error-questions/[id]
 * 更新错题
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { success, data: updateData, error } = UpdateQuestionSchema.safeParse(body);
    
    if (!success) {
      return NextResponse.json({ error: '参数错误', details: error.issues }, { status: 400 });
    }

    const db = getDb();

    // 先检查错题是否存在且属于当前用户
    const existingQuestions = await db
      .select({ id: errorQuestions.id })
      .from(errorQuestions)
      .where(and(
        eq(errorQuestions.id, id),
        eq(errorQuestions.userId, userId)
      ));

    if (existingQuestions.length === 0) {
      return NextResponse.json({ error: '错题不存在' }, { status: 404 });
    }

    // 更新主表字段
    if (Object.keys(updateData).length > 0) {
      const updateFields: Partial<typeof errorQuestions.$inferInsert> = {};
      if (updateData.type) updateFields.type = updateData.type;
      if (updateData.content) updateFields.content = updateData.content;
      if (updateData.correctAnswer !== undefined) updateFields.correctAnswer = updateData.correctAnswer;
      if (updateData.userAnswer !== undefined) updateFields.userAnswer = updateData.userAnswer;
      if (updateData.errorReason !== undefined) updateFields.errorReason = updateData.errorReason;
      if (updateData.masteryLevel !== undefined) updateFields.masteryLevel = updateData.masteryLevel;
      updateFields.updatedAt = new Date().toISOString();

      if (Object.keys(updateFields).length > 0) {
        await db
          .update(errorQuestions)
          .set(updateFields)
          .where(eq(errorQuestions.id, id));
      }
    }

    // 更新标签
    if (updateData.tags !== undefined) {
      // 先删除原有标签
      await db
        .delete(errorQuestionTags)
        .where(eq(errorQuestionTags.questionId, id));
      
      // 新增新标签
      if (updateData.tags.length > 0) {
        const tagValues = updateData.tags.map((tag: string) => ({
          questionId: id,
          tag,
        }));
        await db.insert(errorQuestionTags).values(tagValues);
      }
    }

    // 更新关联单词
    if (updateData.relatedWords !== undefined) {
      // 先删除原有关联
      await db
        .delete(errorQuestionWordRel)
        .where(eq(errorQuestionWordRel.questionId, id));
      
      // 新增新的关联
      if (updateData.relatedWords.length > 0) {
        // 查询用户的这些单词记录
        const existingWords = await db
          .select({ id: storyWords.id, word: storyWords.word })
          .from(storyWords)
          .where(and(
            eq(storyWords.userId, userId),
            inArray(storyWords.word, updateData.relatedWords)
          ));

        const existingWordMap = new Map(existingWords.map(w => [w.word, w.id]));
        const relValues: { questionId: string; wordId: string; }[] = [];

        for (const word of updateData.relatedWords) {
          let wordId = existingWordMap.get(word);
          
          // 如果单词不存在，创建新的单词记录
          if (!wordId) {
            const insertedWords = await db
              .insert(storyWords)
              .values({
                userId,
                word,
              })
              .returning({ id: storyWords.id });
            
            if (insertedWords.length > 0) {
              wordId = insertedWords[0].id;
            }
          }

          if (wordId) {
            relValues.push({ questionId: id, wordId });
          }
        }

        // 保存关联关系
        if (relValues.length > 0) {
          await db.insert(errorQuestionWordRel).values(relValues);
        }
      }
    }

    return NextResponse.json({
      message: '更新成功',
    });
  } catch (error) {
    console.error('Update error question error:', error);
    return NextResponse.json(
      { error: '更新失败，请重试' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/error-questions/[id]
 * 删除错题
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { id } = await params;
    const db = getDb();

    // 检查错题是否存在且属于当前用户
    const existingQuestions = await db
      .select({ id: errorQuestions.id })
      .from(errorQuestions)
      .where(and(
        eq(errorQuestions.id, id),
        eq(errorQuestions.userId, userId)
      ));

    if (existingQuestions.length === 0) {
      return NextResponse.json({ error: '错题不存在' }, { status: 404 });
    }

    // 删除错题（关联的标签和单词关联会因为外键ON DELETE CASCADE自动删除）
    await db
      .delete(errorQuestions)
      .where(eq(errorQuestions.id, id));

    return NextResponse.json({
      message: '删除成功',
    });
  } catch (error) {
    console.error('Delete error question error:', error);
    return NextResponse.json(
      { error: '删除失败，请重试' },
      { status: 500 }
    );
  }
}