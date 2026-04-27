-- 扩展story_words表，新增错题集相关字段
ALTER TABLE "story_words" ADD COLUMN "error_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "story_words" ADD COLUMN "mastery_level" integer DEFAULT 50 NOT NULL;
ALTER TABLE "story_words" ADD COLUMN "last_error_at" timestamp with time zone;

-- 创建错题主表
CREATE TABLE "error_questions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"type" varchar(32) NOT NULL,
	"content" jsonb NOT NULL,
	"correct_answer" text NOT NULL,
	"user_answer" text,
	"error_reason" text,
	"mastery_level" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "error_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);

-- 创建错题知识点标签表
CREATE TABLE "error_question_tags" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" varchar(36) NOT NULL,
	"tag" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "error_question_tags_question_id_error_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."error_questions"("id") ON DELETE cascade ON UPDATE no action
);

-- 创建错题与单词关联表
CREATE TABLE "error_question_word_rel" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" varchar(36) NOT NULL,
	"word_id" varchar(36) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "error_question_word_rel_question_id_error_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."error_questions"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "error_question_word_rel_word_id_story_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."story_words"("id") ON DELETE cascade ON UPDATE no action
);

-- 创建索引
CREATE INDEX "error_questions_user_id_idx" ON "error_questions" USING btree ("user_id");
CREATE INDEX "error_questions_type_idx" ON "error_questions" USING btree ("type");
CREATE INDEX "error_questions_mastery_level_idx" ON "error_questions" USING btree ("mastery_level");

CREATE INDEX "error_question_tags_question_id_idx" ON "error_question_tags" USING btree ("question_id");
CREATE INDEX "error_question_tags_tag_idx" ON "error_question_tags" USING btree ("tag");

CREATE INDEX "error_question_word_rel_question_id_idx" ON "error_question_word_rel" USING btree ("question_id");
CREATE INDEX "error_question_word_rel_word_id_idx" ON "error_question_word_rel" USING btree ("word_id");
CREATE INDEX "error_question_word_rel_question_word_idx" ON "error_question_word_rel" USING btree ("question_id","word_id");