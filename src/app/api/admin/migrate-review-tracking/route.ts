import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { sql, eq } from 'drizzle-orm';
import { reviewRecords, reviewSessions, errorQuestions } from '@/storage/database/shared/schema';

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const dryRun = searchParams.get('dryRun') !== 'false';

    const userId = request.cookies.get('user_id')?.value;
    if (!userId) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const db = await getDb();

    // Reset review data
    if (action === 'reset') {
      if (!dryRun) {
        // Delete review records
        await db.delete(reviewRecords).where(eq(reviewRecords.userId, userId));
        // Delete review sessions
        await db.delete(reviewSessions).where(eq(reviewSessions.userId, userId));
        // Reset error questions
        await db.update(errorQuestions)
          .set({
            masteryLevel: 30,
            lastReviewedAt: null,
            reviewCount: 0,
            lastResult: null,
          })
          .where(eq(errorQuestions.userId, userId));
      }

      return NextResponse.json({
        success: true,
        dryRun,
        action: 'reset-review',
        message: 'Review data reset completed'
      });
    }

    // Original migration
    const results: { action: string; status: string; message?: string }[] = [];

    const migrationStatements = [
      {
        sql: `ALTER TABLE "error_questions" ADD COLUMN IF NOT EXISTS "last_reviewed_at" TIMESTAMP WITH TIME ZONE`,
        action: 'Add last_reviewed_at column'
      },
      {
        sql: `ALTER TABLE "error_questions" ADD COLUMN IF NOT EXISTS "review_count" INTEGER NOT NULL DEFAULT 0`,
        action: 'Add review_count column'
      },
      {
        sql: `ALTER TABLE "error_questions" ADD COLUMN IF NOT EXISTS "last_result" VARCHAR(16)`,
        action: 'Add last_result column'
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS "error_questions_review_count_idx" ON "error_questions" ("review_count")`,
        action: 'Create review_count index'
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS "error_questions_last_result_idx" ON "error_questions" ("last_result")`,
        action: 'Create last_result index'
      }
    ];

    if (!dryRun) {
      for (const statement of migrationStatements) {
        try {
          await db.execute(sql.raw(statement.sql));
          results.push({ action: statement.action, status: 'success' });
        } catch (err) {
          results.push({
            action: statement.action,
            status: 'error',
            message: err instanceof Error ? err.message : String(err)
          });
        }
      }
    } else {
      for (const statement of migrationStatements) {
        results.push({
          action: statement.action,
          status: 'dry-run',
          message: 'Would execute'
        });
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      results
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
