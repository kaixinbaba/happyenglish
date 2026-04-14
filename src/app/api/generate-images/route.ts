import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { storyImages } from '@/storage/database/shared/schema';
import { generateImage } from '@/lib/image-generation';
import { uploadImage } from '@/lib/r2';

export interface GenerateImagesRequest {
  storyId: string;
  imagePrompts: string[];
}

export interface GenerateImagesResponse {
  images: string[];
  failed: number[];
}

export async function POST(request: NextRequest) {
  try {
    const { storyId, imagePrompts } = await request.json() as GenerateImagesRequest;

    if (!storyId || !imagePrompts || imagePrompts.length === 0) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const images: string[] = [];
    const failed: number[] = [];

    // Generate images sequentially (each is a separate request that needs polling)
    for (let i = 0; i < imagePrompts.length; i++) {
      try {
        const prompt = `Colorful children's book illustration, cartoon style, bright and cheerful colors. ${imagePrompts[i]}`;
        const imageBuffer = await generateImage(prompt);

        if (imageBuffer) {
          const key = `stories/${storyId}/${i}.webp`;
          const imageUrl = await uploadImage(key, imageBuffer);
          images.push(imageUrl);
        } else {
          failed.push(i);
        }
      } catch (imageError) {
        console.error(`Failed to generate image ${i + 1}:`, imageError);
        failed.push(i);
      }
    }

    // Save images to database if we have a valid storyId
    if (images.length > 0) {
      try {
        const db = getDb();
        await db.insert(storyImages).values(
          images.map((url, index) => ({
            storyId,
            imageUrl: url,
            orderIndex: index,
          }))
        );
      } catch (dbError) {
        console.error('Database image save error:', dbError);
        // Non-critical, images are still accessible via R2 URLs
      }
    }

    return NextResponse.json({
      images,
      failed,
    } as GenerateImagesResponse);
  } catch (error) {
    console.error('Generate images error:', error);
    return NextResponse.json(
      { error: '图片生成失败' },
      { status: 500 }
    );
  }
}
