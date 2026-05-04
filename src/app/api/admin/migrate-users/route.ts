import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import {
  users,
  errorQuestions,
  storyWords,
  stories,
} from '@/storage/database/shared/schema';
import { eq, inArray, sql, like, or, and } from 'drizzle-orm';

interface MigrationStats {
  totalUsersProcessed: number;
  usersMigrated: number;
  questionsMigrated: number;
  tagsMigrated: number;
  wordRelsMigrated: number;
  storyWordsMigrated: number;
  storiesMigrated: number;
  storyImagesMigrated: number;
  usersDeleted: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dryRun = searchParams.get('dryRun') !== 'false'; // Default to dry-run

    // Security: Only allow POST, no authentication for now (use carefully)
    if (request.method !== 'POST') {
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const db = await getDb();
    const stats: MigrationStats = {
      totalUsersProcessed: 0,
      usersMigrated: 0,
      questionsMigrated: 0,
      tagsMigrated: 0,
      wordRelsMigrated: 0,
      storyWordsMigrated: 0,
      storiesMigrated: 0,
      storyImagesMigrated: 0,
      usersDeleted: 0,
      errors: []
    };

    // Step 1: Find all canonical users (feishu_{open_id} format)
    const canonicalUsers = await db
      .select()
      .from(users)
      .where(like(users.nickname, 'feishu_%'));

    stats.totalUsersProcessed = canonicalUsers.length;

    for (const canonicalUser of canonicalUsers) {
      try {
        const openId = canonicalUser.nickname.replace('feishu_', '');
        const openIdShort = openId.slice(0, 6);

        // Find duplicate users for this open_id
        // Look for:
        // 1. Users whose nickname is similar to "飞书用户_{openIdShort}"
        // 2. Users that might be the same person (created around the same time, same avatar)
        const duplicateUsers = await db
          .select()
          .from(users)
          .where(
            and(
              sql`${users.id} != ${canonicalUser.id}`,
              or(
                // Match "飞书用户_{openIdShort}" pattern
                like(users.nickname, `飞书用户_${openIdShort}%`),
                // Match real name pattern (but be careful)
                // For safety, we only match avatars that are identical
                and(
                  sql`${users.avatarUrl} = ${canonicalUser.avatarUrl}`,
                  sql`${users.nickname} NOT LIKE 'feishu_%'`
                )
              )
            )
          );

        // Also find any user that might have data by checking error_questions
        // Look for users created around the same time
        if (duplicateUsers.length === 0) {
          const recentUsers = await db
            .select()
            .from(users)
            .where(
              and(
                sql`${users.id} != ${canonicalUser.id}`,
                sql`${users.nickname} NOT LIKE 'feishu_%'`,
                sql`${users.createdAt} >= ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()}` // Last 30 days
              )
            );

          // Check if these users have data that should belong to canonical user
          for (const user of recentUsers) {
            const hasQuestions = await db
              .select({ count: sql<number>`count(*)` })
              .from(errorQuestions)
              .where(eq(errorQuestions.userId, user.id));

            if (hasQuestions[0]?.count > 0) {
              duplicateUsers.push(user);
            }
          }
        }

        if (duplicateUsers.length > 0) {
          console.log(`Migrating data for canonical user: ${canonicalUser.nickname}`);
          console.log(`Found ${duplicateUsers.length} duplicate user(s)`);

          const duplicateUserIds = duplicateUsers.map(u => u.id);

          if (!dryRun) {
            // Step 2: Migrate error_questions
            const questionResult = await db
              .update(errorQuestions)
              .set({ userId: canonicalUser.id })
              .where(inArray(errorQuestions.userId, duplicateUserIds))
              .returning({ id: errorQuestions.id });

            stats.questionsMigrated += questionResult.length;

            if (questionResult.length > 0) {
              console.log(`  - Migrated ${questionResult.length} error questions`);
            }

            // Step 3: error_question_tags and error_question_word_rel are
            // linked via question_id, no need to update them separately

            // Step 4: Migrate story_words
            const storyWordsResult = await db
              .update(storyWords)
              .set({ userId: canonicalUser.id })
              .where(inArray(storyWords.userId, duplicateUserIds))
              .returning({ id: storyWords.id });

            stats.storyWordsMigrated += storyWordsResult.length;

            if (storyWordsResult.length > 0) {
              console.log(`  - Migrated ${storyWordsResult.length} story words`);
            }

            // Step 5: Migrate stories
            const storiesResult = await db
              .update(stories)
              .set({ userId: canonicalUser.id })
              .where(inArray(stories.userId, duplicateUserIds))
              .returning({ id: stories.id });

            stats.storiesMigrated += storiesResult.length;

            if (storiesResult.length > 0) {
              console.log(`  - Migrated ${storiesResult.length} stories`);
            }

            // story_images are linked via story_id, no need to update

            // Step 6: Delete duplicate users
            const deleteResult = await db
              .delete(users)
              .where(inArray(users.id, duplicateUserIds))
              .returning({ id: users.id });

            stats.usersDeleted += deleteResult.length;
            stats.usersMigrated++;

            console.log(`  - Deleted ${deleteResult.length} duplicate users`);
          } else {
            // Dry-run: count what would be migrated
            const questionCount = await db
              .select({ count: sql<number>`count(*)` })
              .from(errorQuestions)
              .where(inArray(errorQuestions.userId, duplicateUserIds));

            const storyWordsCount = await db
              .select({ count: sql<number>`count(*)` })
              .from(storyWords)
              .where(inArray(storyWords.userId, duplicateUserIds));

            const storiesCount = await db
              .select({ count: sql<number>`count(*)` })
              .from(stories)
              .where(inArray(stories.userId, duplicateUserIds));

            stats.questionsMigrated += questionCount[0]?.count || 0;
            stats.storyWordsMigrated += storyWordsCount[0]?.count || 0;
            stats.storiesMigrated += storiesCount[0]?.count || 0;
            stats.usersMigrated++;
            stats.usersDeleted += duplicateUsers.length;

            console.log(`  [DRY-RUN] Would migrate ${questionCount[0]?.count || 0} questions`);
            console.log(`  [DRY-RUN] Would migrate ${storyWordsCount[0]?.count || 0} story words`);
            console.log(`  [DRY-RUN] Would migrate ${storiesCount[0]?.count || 0} stories`);
            console.log(`  [DRY-RUN] Would delete ${duplicateUsers.length} users`);
          }
        }
      } catch (userError) {
        const errorMsg = `Error migrating user ${canonicalUser.id}: ${userError}`;
        console.error(errorMsg);
        stats.errors.push(errorMsg);
      }
    }

    // Also handle the reverse case: if there are users with data but no canonical user
    // Find users that don't have feishu_ prefix but might need to become canonical
    const nonCanonicalUsers = await db
      .select()
      .from(users)
      .where(sql`${users.nickname} NOT LIKE 'feishu_%'`);

    for (const user of nonCanonicalUsers) {
      const hasQuestions = await db
        .select({ count: sql<number>`count(*)` })
        .from(errorQuestions)
        .where(eq(errorQuestions.userId, user.id));

      if (hasQuestions[0]?.count > 0 && user.avatarUrl) {
        // This user has data, check if they might be a Feishu user without canonical
        // In this case, just log - we don't want to make assumptions
        console.log(`Note: User ${user.nickname} has data but no canonical feishu_ user`);
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      stats
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
