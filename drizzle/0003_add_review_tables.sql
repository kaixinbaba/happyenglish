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
