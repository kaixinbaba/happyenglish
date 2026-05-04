CREATE TABLE IF NOT EXISTS "error_question_tag_rel" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" varchar(36) NOT NULL,
	"tag_id" varchar(36) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "error_question_tag_rel" ADD CONSTRAINT "error_question_tag_rel_question_id_error_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."error_questions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "error_question_tag_rel" ADD CONSTRAINT "error_question_tag_rel_tag_id_error_question_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."error_question_tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
   AND table_name = 'error_question_tags'
   AND column_name = 'question_id'
 ) THEN
  INSERT INTO "error_question_tag_rel" ("question_id", "tag_id", "created_at")
  SELECT legacy."question_id", canonical."id", min(legacy."created_at")
  FROM "error_question_tags" legacy
  JOIN (
   SELECT "tag", min("id") AS "id"
   FROM "error_question_tags"
   GROUP BY "tag"
  ) canonical ON canonical."tag" = legacy."tag"
  WHERE legacy."question_id" IS NOT NULL
  GROUP BY legacy."question_id", canonical."id"
  ON CONFLICT DO NOTHING;
 END IF;
END $$;
--> statement-breakpoint
DELETE FROM "error_question_tags" tag
USING (
	SELECT "tag", min("id") AS "id"
	FROM "error_question_tags"
	GROUP BY "tag"
) canonical
WHERE tag."tag" = canonical."tag"
	AND tag."id" <> canonical."id";
--> statement-breakpoint
DROP INDEX IF EXISTS "error_question_tags_question_id_idx";
--> statement-breakpoint
ALTER TABLE "error_question_tags" DROP CONSTRAINT IF EXISTS "error_question_tags_question_id_error_questions_id_fk";
--> statement-breakpoint
ALTER TABLE "error_question_tags" DROP COLUMN IF EXISTS "question_id";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "error_question_tags_tag_unique" ON "error_question_tags" USING btree ("tag");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_question_tag_rel_question_id_idx" ON "error_question_tag_rel" USING btree ("question_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "error_question_tag_rel_tag_id_idx" ON "error_question_tag_rel" USING btree ("tag_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "error_question_tag_rel_question_tag_unique" ON "error_question_tag_rel" USING btree ("question_id","tag_id");
