import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getLLMClient, getLLMModel } from '@/lib/llm';

const GenerateTagsRequestSchema = z.object({
  type: z.enum(['spelling', 'word-choice', 'multiple-choice', 'grammar', 'translation', 'reading', 'custom']),
  content: z.record(z.string(), z.any()),
  correctAnswer: z.string(),
  userAnswer: z.string().optional(),
  errorReason: z.string().optional(),
  relatedWords: z.array(z.string()).default([]),
});

export async function POST(request: NextRequest) {
  try {
    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { success, data: questionData, error } = GenerateTagsRequestSchema.safeParse(body);
    
    if (!success) {
      return NextResponse.json({ error: '参数错误', details: error.issues }, { status: 400 });
    }

    // 构建LLM提示词
    let questionContentStr = '';
    if (typeof questionData.content === 'object') {
      questionContentStr = JSON.stringify(questionData.content, null, 2);
    } else {
      questionContentStr = String(questionData.content);
    }

    const prompt = `你是一个小学英语老师，现在有一道学生做错的英语题，请分析这道题考察的知识点，生成3-5个知识点标签。
题型：${questionData.type}
题目内容：${questionContentStr}
正确答案：${questionData.correctAnswer}
学生错误答案：${questionData.userAnswer || '无'}
错误原因：${questionData.errorReason || '无'}
关联的单词：${questionData.relatedWords.join(', ')}

要求：
1. 标签要准确，符合小学英语知识点分类
2. 标签要简短，每个标签不超过10个字
3. 生成3-5个标签，用JSON数组格式返回，例如：["一般现在时", "名词单复数", "介词用法"]
4. 不要返回其他多余内容，只返回JSON数组
`;

    // 调用LLM生成标签
    const client = getLLMClient();
    const model = getLLMModel();

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const rawContent = response.choices[0]?.message?.content || '';
    
    // 解析JSON
    let tags: string[] = [];
    try {
      // 清理返回内容，提取JSON
      const cleanedContent = rawContent.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/```\s*$/, '')
        .trim();
      
      const jsonMatch = cleanedContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        tags = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Parse tags error:', parseError);
      // 解析失败的话，用关联单词作为标签
      tags = questionData.relatedWords.slice(0, 5);
    }

    // 去重，过滤空标签
    tags = [...new Set(tags.filter(tag => typeof tag === 'string' && tag.trim().length > 0))];

    // 最多返回5个标签
    if (tags.length > 5) {
      tags = tags.slice(0, 5);
    }

    return NextResponse.json({
      tags,
    });
  } catch (error) {
    console.error('Generate tags error:', error);
    return NextResponse.json(
      { error: '生成标签失败，请重试', tags: [] },
      { status: 500 }
    );
  }
}