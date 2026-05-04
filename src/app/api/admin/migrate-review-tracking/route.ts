import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dryRun = searchParams.get('dryRun') !== 'false';

    if (request.method !== 'POST') {
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const db = await getDb();
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
