ALTER TABLE "error_questions"
ADD COLUMN IF NOT EXISTS "last_reviewed_at" TIMESTAMP WITH TIME ZONE;

ALTER TABLE "error_questions"
ADD COLUMN IF NOT EXISTS "review_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "error_questions"
ADD COLUMN IF NOT EXISTS "last_result" VARCHAR(16);

CREATE INDEX IF NOT EXISTS "error_questions_review_count_idx"
ON "error_questions" ("review_count");

CREATE INDEX IF NOT EXISTS "error_questions_last_result_idx"
ON "error_questions" ("last_result");
