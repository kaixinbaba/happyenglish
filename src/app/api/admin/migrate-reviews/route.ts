import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/storage/database/db';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dryRun = searchParams.get('dryRun') !== 'false'; // Default to dry-run

    if (request.method !== 'POST') {
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const db = await getDb();
    const results: { table: string; status: string; message?: string }[] = [];

    const migrationSQL = `
      CREATE TABLE IF NOT EXISTS "review_sessions" (
        "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" varchar(36) NOT NULL,
        "total_questions" integer NOT NULL,
        "completed_questions" integer NOT NULL DEFAULT 0,
        "correct_count" integer NOT NULL DEFAULT 0,
        "wrong_count" integer NOT NULL DEFAULT 0,
        "status" varchar(16) NOT NULL DEFAULT 'in_progress',
        "started_at" timestamp with time zone DEFAULT now() NOT NULL,
        "completed_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
      );

      CREATE TABLE IF NOT EXISTS "review_records" (
        "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        "session_id" varchar(36) NOT NULL,
        "question_id" varchar(36) NOT NULL,
        "user_id" varchar(36) NOT NULL,
        "result" varchar(16) NOT NULL,
        "previous_mastery_level" integer NOT NULL,
        "new_mastery_level" integer NOT NULL,
        "order_index" integer NOT NULL DEFAULT 0,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        FOREIGN KEY ("session_id") REFERENCES "review_sessions"("id") ON DELETE cascade,
        FOREIGN KEY ("question_id") REFERENCES "error_questions"("id") ON DELETE cascade,
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
      );

      CREATE INDEX IF NOT EXISTS "review_sessions_user_id_idx" ON "review_sessions" ("user_id");
      CREATE INDEX IF NOT EXISTS "review_sessions_status_idx" ON "review_sessions" ("status");
      CREATE INDEX IF NOT EXISTS "review_sessions_started_at_idx" ON "review_sessions" ("started_at");

      CREATE INDEX IF NOT EXISTS "review_records_session_id_idx" ON "review_records" ("session_id");
      CREATE INDEX IF NOT EXISTS "review_records_question_id_idx" ON "review_records" ("question_id");
      CREATE INDEX IF NOT EXISTS "review_records_user_id_idx" ON "review_records" ("user_id");
      CREATE INDEX IF NOT EXISTS "review_records_created_at_idx" ON "review_records" ("created_at");
    `;

    if (!dryRun) {
      // Execute the migration
      const statements = migrationSQL.split(';').filter(s => s.trim());

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await db.execute(sql.raw(statement));

            // Determine which table/index we created
            let table = 'unknown';
            if (statement.includes('review_sessions')) table = 'review_sessions';
            else if (statement.includes('review_records')) table = 'review_records';
            else if (statement.includes('INDEX')) {
              if (statement.includes('review_sessions')) table = 'review_sessions index';
              else table = 'review_records index';
            }

            results.push({ table, status: 'success' });
          } catch (err) {
            results.push({
              table: statement.includes('review_sessions') ? 'review_sessions' : 'review_records',
              status: 'error',
              message: err instanceof Error ? err.message : String(err)
            });
          }
        }
      }
    } else {
      // Dry run - just report what would be done
      results.push({ table: 'review_sessions', status: 'dry-run', message: 'Would create table' });
      results.push({ table: 'review_records', status: 'dry-run', message: 'Would create table' });
      results.push({ table: 'review_sessions indexes', status: 'dry-run', message: 'Would create indexes' });
      results.push({ table: 'review_records indexes', status: 'dry-run', message: 'Would create indexes' });
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
