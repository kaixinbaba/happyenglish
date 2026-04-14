import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { stories, storyImages, storyWords } from '@/storage/database/shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { getLLMClient, getLLMModel } from '@/lib/llm';

export interface GenerateRequest {
  words: string[];
  ageGroup: string;
  wordCount: number;
  imageCount: number;
}

export interface GenerateResponse {
  story: string;
  translation: string;
  images: string[];
  words: string[];
  wordMappings: Record<string, string>;
  storyId?: string;
  learnedWords?: string[];
  // New: image generation data so frontend can call /api/generate-images
  storyIdForImages?: string;
  imagePrompts?: string[];
  imageCount?: number;
  ageGroup?: string;
  wordCount?: number;
}

const ageGroupDescriptions: Record<string, string> = {
  'preschool': '学龄前儿童 (3-6岁), 使用最简单的词汇和短句',
  'grade1-3': '一二三年级学生 (6-9岁), 使用简单的词汇和句子',
  'grade4-5': '四五年级学生 (9-11岁), 使用中等难度的词汇',
  'grade6-7': '六七年级学生 (11-13岁), 使用较为丰富的词汇',
  'grade8-9': '八九年级学生 (13-15岁), 使用较为成熟的表达方式',
};

async function callLLM(messages: { role: 'user' | 'assistant' | 'system'; content: string }[], temperature: number): Promise<string> {
  const client = getLLMClient();
  const model = getLLMModel();

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Parse LLM translation response (story + wordMappings JSON)
 * Handles various LLM JSON formatting issues robustly.
 */
function parseTranslationResponse(rawContent: string): { translation: string; wordMappings: Record<string, string> } {
  let translation = '';
  let wordMappings: Record<string, string> = {};

  const rawTranslation = rawContent.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();

  // Try to extract and parse the JSON from LLM response
  let parsed = false;

  // Attempt 1: Direct JSON.parse on the extracted JSON object
  const jsonMatch = rawTranslation.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      if (obj.translation) translation = obj.translation;
      if (obj.wordMappings) wordMappings = obj.wordMappings;
      parsed = true;
    } catch {
      // Attempt 2: Fix common LLM JSON issues (unescaped newlines and quotes inside string values)
      try {
        const jsonStr = jsonMatch[0];
        const wmKeyIdx = jsonStr.indexOf('"wordMappings"');
        if (wmKeyIdx !== -1) {
          const wmBraceStart = jsonStr.indexOf('{', wmKeyIdx);
          let wmObj: Record<string, string> = {};
          if (wmBraceStart !== -1) {
            let depth = 0;
            let wmBraceEnd = wmBraceStart;
            for (let i = wmBraceStart; i < jsonStr.length; i++) {
              if (jsonStr[i] === '{') depth++;
              if (jsonStr[i] === '}') depth--;
              if (depth === 0) { wmBraceEnd = i; break; }
            }
            try {
              wmObj = JSON.parse(jsonStr.substring(wmBraceStart, wmBraceEnd + 1));
            } catch {
              // wordMappings parse failed
            }
          }

          const tKeyIdx = jsonStr.indexOf('"translation"');
          if (tKeyIdx !== -1) {
            const colonIdx = jsonStr.indexOf(':', tKeyIdx + 13);
            if (colonIdx !== -1) {
              const quoteStart = jsonStr.indexOf('"', colonIdx + 1);
              if (quoteStart !== -1) {
                let endIdx = wmKeyIdx;
                let searchBack = wmKeyIdx - 1;
                while (searchBack > quoteStart && /[\s,]/.test(jsonStr[searchBack])) searchBack--;
                if (jsonStr[searchBack] === '"') {
                  const rawTranslationText = jsonStr.substring(quoteStart + 1, searchBack);
                  translation = rawTranslationText
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"')
                    .replace(/\n/g, '\n');
                  wordMappings = wmObj;
                  parsed = true;
                }
              }
            }
          }
        }

        if (!parsed) {
          let inString = false;
          let escaped = false;
          let fixed = '';
          for (let i = 0; i < jsonStr.length; i++) {
            const ch = jsonStr[i];
            if (escaped) { fixed += ch; escaped = false; continue; }
            if (ch === '\\') { fixed += ch; escaped = true; continue; }
            if (ch === '"') { inString = !inString; fixed += ch; continue; }
            if (ch === '\n' && inString) { fixed += '\\n'; continue; }
            fixed += ch;
          }
          const obj = JSON.parse(fixed);
          if (obj.translation) translation = obj.translation;
          if (obj.wordMappings) wordMappings = obj.wordMappings;
          parsed = true;
        }
      } catch (e) {
        console.log('JSON parse failed, trying manual extraction', e);
      }
    }
  }

  // Attempt 3: Manual extraction - robust approach using "wordMappings" as anchor
  if (!parsed) {
    const text = rawTranslation;

    const wmStart = text.indexOf('"wordMappings"');
    if (wmStart !== -1) {
      const braceStart = text.indexOf('{', wmStart);
      if (braceStart !== -1) {
        let depth = 0;
        let braceEnd = braceStart;
        for (let i = braceStart; i < text.length; i++) {
          if (text[i] === '{') depth++;
          if (text[i] === '}') depth--;
          if (depth === 0) { braceEnd = i; break; }
        }
        try {
          wordMappings = JSON.parse(text.substring(braceStart, braceEnd + 1));
        } catch {
          // ignore
        }
      }
    }

    const tKey = '"translation"';
    const tStart = text.indexOf(tKey);
    if (tStart !== -1) {
      const colonIdx = text.indexOf(':', tStart + tKey.length);
      if (colonIdx !== -1) {
        const quoteStart = text.indexOf('"', colonIdx + 1);
        if (quoteStart !== -1) {
          const endAnchor = wmStart !== -1 ? wmStart : text.length;
          let endIdx = endAnchor - 1;
          while (endIdx > quoteStart && /[\s,]/.test(text[endIdx])) endIdx--;
          if (text[endIdx] === '"') {
            translation = text.substring(quoteStart + 1, endIdx)
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"');
          } else {
            translation = text.substring(quoteStart + 1, endIdx)
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/"\s*,?\s*$/, '');
          }
        }
      }
    }

    if (!translation) {
      translation = text
        .replace(/^\s*\{/, '')
        .replace(/\}\s*$/, '')
        .replace(/"translation"\s*:\s*"?/, '')
        .replace(/"?\s*,?\s*"wordMappings"\s*:\s*\{[^}]*\}/, '')
        .replace(/^"|"$/g, '')
        .trim();
    }
  }

  // Cleanup
  translation = translation
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .trim();

  return { translation, wordMappings };
}

async function generateImagePrompts(
  story: string,
  words: string[],
  imageCount: number
): Promise<string[]> {
  const promptRequest = `Given this children's story, create ${imageCount} detailed image prompts for illustration.

Story: ${story}

Key vocabulary (nouns should appear in illustrations): ${words.join(', ')}

Requirements:
1. Create exactly ${imageCount} image prompts, one per line
2. Each prompt should describe a scene that tells part of the story
3. The scenes should follow the story's narrative sequence
4. Include key visual elements and characters
5. Keep prompts concise but descriptive
6. If any target words are nouns, try to include them in the corresponding image

Output format: Just output the ${imageCount} prompts, one per line, no numbering or extra text.`;

  const content = await callLLM([{ role: 'user', content: promptRequest }], 0.7);

  const prompts = content.split('\n').filter(line => line.trim().length > 0);

  while (prompts.length < imageCount) {
    prompts.push(`A colorful scene from the story featuring: ${words.slice(0, 3).join(', ')}`);
  }

  return prompts.slice(0, imageCount);
}

export async function POST(request: NextRequest) {
  try {
    const { words, ageGroup, wordCount, imageCount } = await request.json() as GenerateRequest;

    if (!words || words.length === 0) {
      return NextResponse.json({ error: '请输入至少一个单词' }, { status: 400 });
    }

    const userId = request.cookies.get('user_id')?.value;
    const db = getDb();

    // Check which words user has learned before (if logged in)
    let learnedWords: string[] = [];
    if (userId) {
      const existingWords = await db
        .select({ word: storyWords.word })
        .from(storyWords)
        .where(and(eq(storyWords.userId, userId), inArray(storyWords.word, words)));

      learnedWords = existingWords.map(w => w.word);
    }

    // Run story, translation, and image prompts in PARALLEL to save time
    const ageGroupDesc = ageGroupDescriptions[ageGroup] || 'children';

    const storyPromise = callLLM([{
      role: 'user',
      content: `You are a children's story writer. Write a short English story for ${ageGroupDesc}.

IMPORTANT REQUIREMENTS:
1. The story MUST use ALL of these target words: ${words.join(', ')}
2. The story should be around ${wordCount} words
3. All other words should be simple and appropriate for the age group
4. The target words should be the ONLY new/difficult vocabulary in the story
5. Make the story engaging and fun for children
6. The story should have a clear beginning, middle, and end
7. DO NOT use markdown formatting like # or ** or *. Just write plain text with proper paragraphs.

Target words to use: ${words.join(', ')}

Write the story now (plain text only, no markdown):`
    }], 0.8);

    const translationPromise = (async () => {
      // We need the story text first, so we await it then call translation
      const storyContent = await storyPromise;
      const cleanedStory = storyContent
        .replace(/^#+\s*/gm, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .trim();

      const translationContent = await callLLM([{
        role: 'user',
        content: `Translate the following English children's story to Chinese.
Keep the translation natural and appropriate for children.

You must output in this exact JSON format:
{
  "translation": "The complete Chinese translation text",
  "wordMappings": {
    "word1": "中文翻译1",
    "word2": "中文翻译2"
  }
}

IMPORTANT:
1. The translation should be plain text, NO markdown formatting
2. Use Chinese quotation marks「」for dialogue, NEVER use ASCII double quotes " inside the translation text
3. Separate paragraphs with \\n\\n (escaped newlines), NOT actual newlines inside the JSON string
4. Make sure all special JSON characters are properly escaped
5. wordMappings should map each English target word to its Chinese translation used in the story
6. Target English words: ${words.join(', ')}

English story:
${cleanedStory}`
      }], 0.5);

      return parseTranslationResponse(translationContent);
    })();

    const imagePromisesPromise = (async () => {
      const storyContent = await storyPromise;
      const cleanedStory = storyContent
        .replace(/^#+\s*/gm, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .trim();
      return generateImagePrompts(cleanedStory, words, imageCount);
    })();

    // Wait for story first
    const storyContent = await storyPromise;

    let story = storyContent
      .replace(/^#+\s*/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .trim();

    // Wait for translation and image prompts in parallel
    const [{ translation, wordMappings }, imagePrompts] = await Promise.all([
      translationPromise,
      imagePromisesPromise,
    ]);

    // Save story to database immediately (if logged in)
    let storyId: string | undefined;

    if (userId) {
      try {
        const storyRecord = await db
          .insert(stories)
          .values({
            userId,
            storyEn: story,
            storyZh: translation,
            ageGroup: ageGroup,
            wordCount,
            imageCount,
          })
          .returning({ id: stories.id });

        if (storyRecord.length > 0) {
          storyId = storyRecord[0].id;

          // Update word learning records
          for (const word of words) {
            const wordTranslation = wordMappings[word] || null;

            if (learnedWords.includes(word)) {
              await db
                .update(storyWords)
                .set({
                  lastLearnedAt: new Date().toISOString(),
                  learnCount: sql`${storyWords.learnCount} + 1`,
                  translation: wordTranslation,
                })
                .where(and(eq(storyWords.userId, userId), eq(storyWords.word, word)));
            } else {
              await db.insert(storyWords).values({
                userId,
                word,
                translation: wordTranslation,
              });
            }
          }
        }
      } catch (dbError) {
        console.error('Database save error:', dbError);
      }
    }

    return NextResponse.json({
      story,
      translation,
      images: [], // Images will be loaded separately
      words,
      wordMappings,
      storyId,
      learnedWords,
      // Pass along data for async image generation
      storyIdForImages: storyId || crypto.randomUUID(),
      imagePrompts,
      imageCount,
      ageGroup,
      wordCount,
    } as GenerateResponse);
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: '生成失败，请重试' },
      { status: 500 }
    );
  }
}
