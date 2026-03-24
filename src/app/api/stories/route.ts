import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { stories, storyImages } from '@/storage/database/shared/schema';
import { eq, desc } from 'drizzle-orm';

// Get stories list for current user
export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: '请先登录', stories: [] }, { status: 401 });
    }

    const db = getDb();

    // Get stories
    const storyList = await db
      .select()
      .from(stories)
      .where(eq(stories.userId, userId))
      .orderBy(desc(stories.createdAt))
      .limit(50);

    // Get images for all stories
    const storyIds = storyList.map(s => s.id);
    let imageMap: Record<string, typeof storyImages.$inferSelect[]> = {};

    if (storyIds.length > 0) {
      const { inArray } = await import('drizzle-orm');
      const allImages = await db
        .select()
        .from(storyImages)
        .where(inArray(storyImages.storyId, storyIds));

      for (const img of allImages) {
        if (!imageMap[img.storyId]) imageMap[img.storyId] = [];
        imageMap[img.storyId].push(img);
      }
    }

    // Combine stories with sorted images, map to snake_case for frontend
    const storiesWithImages = storyList.map(story => ({
      id: story.id,
      story_en: story.storyEn,
      story_zh: story.storyZh,
      age_group: story.ageGroup,
      word_count: story.wordCount,
      image_count: story.imageCount,
      created_at: story.createdAt,
      story_images: (imageMap[story.id] || []).sort((a, b) => a.orderIndex - b.orderIndex)
        .map(img => ({ image_url: img.imageUrl, order_index: img.orderIndex })),
    }));

    return NextResponse.json({ stories: storiesWithImages });
  } catch (error) {
    console.error('Get stories error:', error);
    return NextResponse.json({ error: '获取失败', stories: [] }, { status: 500 });
  }
}
