import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { errorQuestions, errorQuestionTagRel, errorQuestionTags, errorQuestionWordRel, storyWords } from '@/storage/database/shared/schema';
import { attachTagsToQuestion } from '@/lib/error-question-tags';
import { eq, and, inArray, sql, or } from 'drizzle-orm';
import { z } from 'zod';

// 错题类型枚举
export const QuestionTypeSchema = z.enum([
  'spelling', // 单词拼写题
  'word-choice', // 词义辨析题
  'multiple-choice', // 单项选择题
  'grammar', // 语法填空题
  'translation', // 句子翻译/连词成句题
  'reading', // 阅读理解题
  'custom' // 自定义题型
]);

// 创建错题请求校验
export const CreateQuestionSchema = z.object({
  type: QuestionTypeSchema,
  content: z.record(z.string(), z.any()), // 不同题型的结构化内容
  correctAnswer: z.string(),
  userAnswer: z.string().optional(),
  errorReason: z.string().optional(),
  masteryLevel: z.number().min(0).max(100).default(0),
  tags: z.array(z.string()).default([]), // 知识点标签
  relatedWords: z.array(z.string()).default([]), // 关联的单词
});

// 列表查询参数校验
const ListQuerySchema = z.object({
  type: QuestionTypeSchema.optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  masteryLevel: z.coerce.number().min(0).max(100).optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export type CreateQuestionRequest = z.infer<typeof CreateQuestionSchema>;
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

/**
 * GET /api/error-questions
 * 获取错题列表，支持筛选
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const { success, data: query, error } = ListQuerySchema.safeParse(queryParams);
    
    if (!success) {
      return NextResponse.json({ error: '参数错误', details: error.issues }, { status: 400 });
    }

    const db = await getDb();
    const whereConditions = [eq(errorQuestions.userId, userId)];

    // 按题型筛选
    if (query.type) {
      whereConditions.push(eq(errorQuestions.type, query.type));
    }

    // 按掌握度筛选
    if (query.masteryLevel !== undefined) {
      whereConditions.push(eq(errorQuestions.masteryLevel, query.masteryLevel));
    }

    // 按标签筛选
    if (query.tag) {
      const tagRecords = await db
        .select({ questionId: errorQuestionTagRel.questionId })
        .from(errorQuestionTagRel)
        .innerJoin(errorQuestionTags, eq(errorQuestionTagRel.tagId, errorQuestionTags.id))
        .where(eq(errorQuestionTags.tag, query.tag));
      const questionIdsWithTag = tagRecords.map(t => t.questionId);

      if (questionIdsWithTag.length === 0) {
        return NextResponse.json({
          list: [],
          pagination: {
            page: query.page,
            pageSize: query.pageSize,
            total: 0,
            totalPages: 0,
          },
        });
      }

      whereConditions.push(inArray(errorQuestions.id, questionIdsWithTag));
    }

    // 关键词搜索：题干内容、答案、错误原因、标签都可匹配
    const search = query.search?.trim();
    if (search) {
      const pattern = `%${search}%`;
      const matchingTagRecords = await db
        .select({ questionId: errorQuestionTagRel.questionId })
        .from(errorQuestionTagRel)
        .innerJoin(errorQuestionTags, eq(errorQuestionTagRel.tagId, errorQuestionTags.id))
        .where(sql`${errorQuestionTags.tag} ILIKE ${pattern}`);
      const questionIdsWithMatchingTag = matchingTagRecords.map(t => t.questionId);

      const searchConditions = [
        sql`${errorQuestions.content}::text ILIKE ${pattern}`,
        sql`${errorQuestions.correctAnswer} ILIKE ${pattern}`,
        sql`${errorQuestions.userAnswer} ILIKE ${pattern}`,
        sql`${errorQuestions.errorReason} ILIKE ${pattern}`,
      ];

      if (questionIdsWithMatchingTag.length > 0) {
        searchConditions.push(inArray(errorQuestions.id, questionIdsWithMatchingTag));
      }

      whereConditions.push(or(...searchConditions)!);
    }

    // 分页参数
    const offset = (query.page - 1) * query.pageSize;
    const limit = query.pageSize;

    // 查询错题列表
    const questionsQuery = db
      .select()
      .from(errorQuestions)
      .where(and(...whereConditions))
      .orderBy(sql`${errorQuestions.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    // 查询总数量
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(errorQuestions)
      .where(and(...whereConditions));

    const [questions, countResult] = await Promise.all([questionsQuery, countQuery]);
    const total = countResult[0]?.count || 0;

    // 查询每个题的标签和关联单词
    const questionIds = questions.map(q => q.id);
    let tags: Record<string, string[]> = {};
    let relatedWords: Record<string, string[]> = {};

    if (questionIds.length > 0) {
      // 查询标签
      const tagRecords = await db
        .select({ questionId: errorQuestionTagRel.questionId, tag: errorQuestionTags.tag })
        .from(errorQuestionTagRel)
        .innerJoin(errorQuestionTags, eq(errorQuestionTagRel.tagId, errorQuestionTags.id))
        .where(inArray(errorQuestionTagRel.questionId, questionIds));
      
      tags = tagRecords.reduce((acc, record) => {
        if (!acc[record.questionId]) acc[record.questionId] = [];
        acc[record.questionId].push(record.tag);
        return acc;
      }, {} as Record<string, string[]>);

      // 查询关联单词
      const wordRecords = await db
        .select({ questionId: errorQuestionWordRel.questionId, word: storyWords.word })
        .from(errorQuestionWordRel)
        .leftJoin(storyWords, eq(errorQuestionWordRel.wordId, storyWords.id))
        .where(inArray(errorQuestionWordRel.questionId, questionIds));
      
      relatedWords = wordRecords.reduce((acc, record) => {
        if (!acc[record.questionId]) acc[record.questionId] = [];
        if (record.word) acc[record.questionId].push(record.word);
        return acc;
      }, {} as Record<string, string[]>);
    }

    // 组装返回数据
    const result = questions.map(question => ({
      ...question,
      tags: tags[question.id] || [],
      relatedWords: relatedWords[question.id] || [],
    }));

    return NextResponse.json({
      list: result,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  } catch (error) {
    console.error('Get error questions error:', error);
    return NextResponse.json(
      { error: '获取错题列表失败，请重试' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/error-questions
 * 创建新错题
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { success, data: questionData, error } = CreateQuestionSchema.safeParse(body);
    
    if (!success) {
      return NextResponse.json({ error: '参数错误', details: error.issues }, { status: 400 });
    }

    const db = await getDb();

    // 1. 创建错题主记录
    const insertedQuestions = await db
      .insert(errorQuestions)
      .values({
        userId,
        type: questionData.type,
        content: questionData.content,
        correctAnswer: questionData.correctAnswer,
        userAnswer: questionData.userAnswer,
        errorReason: questionData.errorReason,
        masteryLevel: questionData.masteryLevel,
      })
      .returning({ id: errorQuestions.id });

    if (insertedQuestions.length === 0) {
      return NextResponse.json({ error: '创建失败' }, { status: 500 });
    }

    const questionId = insertedQuestions[0].id;

    // 2. 保存知识点标签
    await attachTagsToQuestion(questionId, questionData.tags);

    // 3. 关联单词，更新单词错误次数和掌握度
    if (questionData.relatedWords.length > 0) {
      // 先查询用户的这些单词记录
      const existingWords = await db
        .select({ id: storyWords.id, word: storyWords.word })
        .from(storyWords)
        .where(and(
          eq(storyWords.userId, userId),
          inArray(storyWords.word, questionData.relatedWords)
        ));

      const existingWordMap = new Map(existingWords.map(w => [w.word, w.id]));
      const relValues: { questionId: string; wordId: string; }[] = [];

      for (const word of questionData.relatedWords) {
        let wordId = existingWordMap.get(word);
        
        // 如果单词不存在，创建新的单词记录
        if (!wordId) {
          const insertedWords = await db
            .insert(storyWords)
            .values({
              userId,
              word,
              errorCount: 1,
              masteryLevel: 30, // 错误的单词初始掌握度低一些
            })
            .returning({ id: storyWords.id });
          
          if (insertedWords.length > 0) {
            wordId = insertedWords[0].id;
          }
        } else {
          // 已存在的单词，更新错误次数和掌握度
          await db
            .update(storyWords)
            .set({
              errorCount: sql`${storyWords.errorCount} + 1`,
              lastErrorAt: new Date().toISOString(),
              // 错误一次掌握度下降10分，最低0分
              masteryLevel: sql`GREATEST(${storyWords.masteryLevel} - 10, 0)`,
            })
            .where(eq(storyWords.id, wordId));
        }

        if (wordId) {
          relValues.push({ questionId, wordId });
        }
      }

      // 保存错题和单词的关联关系
      if (relValues.length > 0) {
        await db.insert(errorQuestionWordRel).values(relValues);
      }
    }

    return NextResponse.json({
      id: questionId,
      message: '创建成功',
    });
  } catch (error) {
    console.error('Create error question error:', error);
    return NextResponse.json(
      { error: '创建失败，请重试' },
      { status: 500 }
    );
  }
}
