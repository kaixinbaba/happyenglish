ALTER TABLE "story_words"
ADD COLUMN IF NOT EXISTS "story_id" VARCHAR(36) REFERENCES "stories"("id") ON DELETE SET NULL;

ALTER TABLE "story_words"
ADD COLUMN IF NOT EXISTS "summary" TEXT;

ALTER TABLE "story_words"
ADD COLUMN IF NOT EXISTS "sentence_hint" TEXT;

CREATE INDEX IF NOT EXISTS "story_words_story_id_idx"
ON "story_words" ("story_id");
