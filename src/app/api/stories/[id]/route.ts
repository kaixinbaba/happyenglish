import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { stories, storyImages, storyWords } from '@/storage/database/shared/schema';
import { eq, and } from 'drizzle-orm';

// Helper function to parse translation text
function parseTranslation(storyZh: string): { translation: string; wordMappings: Record<string, string> } {
  let translation = storyZh;
  let wordMappings: Record<string, string> = {};

  if (storyZh.trim().startsWith('{') || storyZh.includes('"translation"')) {
    try {
      const jsonStr = storyZh
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/```\s*$/, '')
        .trim();

      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.translation && typeof parsed.translation === 'string') {
          translation = parsed.translation;
        }
        if (parsed.wordMappings && typeof parsed.wordMappings === 'object') {
          wordMappings = parsed.wordMappings;
        }
      }
    } catch {
      const translationMatch = storyZh.match(/"translation"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (translationMatch) {
        translation = translationMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }

      const mappingsMatch = storyZh.match(/"wordMappings"\s*:\s*\{[^}]*\}/);
      if (mappingsMatch) {
        try {
          const mappingsObj = JSON.parse('{' + mappingsMatch[0] + '}');
          wordMappings = mappingsObj.wordMappings || {};
        } catch {
          // Ignore mapping parse errors
        }
      }
    }
  }

  return { translation, wordMappings };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.cookies.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const db = await getDb();

    // Get story
    const storyResult = await db
      .select()
      .from(stories)
      .where(and(eq(stories.id, id), eq(stories.userId, userId)))
      .limit(1);

    if (storyResult.length === 0) {
      return NextResponse.json({ error: '故事不存在' }, { status: 404 });
    }

    const story = storyResult[0];

    // Get images
    const images = await db
      .select()
      .from(storyImages)
      .where(eq(storyImages.storyId, id));

    // Parse translation and extract word mappings
    const { translation, wordMappings } = parseTranslation(story.storyZh);

    // Get words for this user
    const wordRecords = await db
      .select({ word: storyWords.word, translation: storyWords.translation })
      .from(storyWords)
      .where(eq(storyWords.userId, userId));

    const words = wordRecords.map(w => ({
      word: w.word,
      translation: w.translation || wordMappings[w.word] || '',
    }));

    const sortedStory = {
      id: story.id,
      story_en: story.storyEn,
      story_zh: translation,
      age_group: story.ageGroup,
      word_count: story.wordCount,
      image_count: story.imageCount,
      created_at: story.createdAt,
      story_images: images.sort((a, b) => a.orderIndex - b.orderIndex)
        .map(img => ({ image_url: img.imageUrl, order_index: img.orderIndex })),
      words,
      wordMappings,
    };

    return NextResponse.json({ story: sortedStory });
  } catch (error) {
    console.error('Get story error:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

// Delete a story
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.cookies.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const db = await getDb();

    // Verify the story belongs to the user
    const storyResult = await db
      .select({ id: stories.id })
      .from(stories)
      .where(and(eq(stories.id, id), eq(stories.userId, userId)))
      .limit(1);

    if (storyResult.length === 0) {
      return NextResponse.json({ error: '故事不存在或无权删除' }, { status: 404 });
    }

    // Delete story images first
    await db.delete(storyImages).where(eq(storyImages.storyId, id));

    // Delete the story (cascade will handle related records)
    await db.delete(stories).where(and(eq(stories.id, id), eq(stories.userId, userId)));

    return NextResponse.json({ success: true, message: '故事已删除' });
  } catch (error) {
    console.error('Delete story error:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
