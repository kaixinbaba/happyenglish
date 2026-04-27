CREATE TABLE "error_question_tags" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" varchar(36) NOT NULL,
	"tag" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_question_word_rel" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" varchar(36) NOT NULL,
	"word_id" varchar(36) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_check" (
	"id" serial NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"story_en" text NOT NULL,
	"story_zh" text NOT NULL,
	"age_group" varchar(32) NOT NULL,
	"word_count" integer NOT NULL,
	"image_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_images" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" varchar(36) NOT NULL,
	"image_url" varchar(1024) NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_words" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"word" varchar(128) NOT NULL,
	"translation" varchar(256),
	"first_learned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_learned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"learn_count" integer DEFAULT 1 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"mastery_level" integer DEFAULT 50 NOT NULL,
	"last_error_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nickname" varchar(128) NOT NULL,
	"avatar_url" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "error_question_tags" ADD CONSTRAINT "error_question_tags_question_id_error_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."error_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_question_word_rel" ADD CONSTRAINT "error_question_word_rel_question_id_error_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."error_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_question_word_rel" ADD CONSTRAINT "error_question_word_rel_word_id_story_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."story_words"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_questions" ADD CONSTRAINT "error_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_images" ADD CONSTRAINT "story_images_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_words" ADD CONSTRAINT "story_words_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "error_question_tags_question_id_idx" ON "error_question_tags" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "error_question_tags_tag_idx" ON "error_question_tags" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "error_question_word_rel_question_id_idx" ON "error_question_word_rel" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "error_question_word_rel_word_id_idx" ON "error_question_word_rel" USING btree ("word_id");--> statement-breakpoint
CREATE INDEX "error_question_word_rel_question_word_idx" ON "error_question_word_rel" USING btree ("question_id","word_id");--> statement-breakpoint
CREATE INDEX "error_questions_user_id_idx" ON "error_questions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "error_questions_type_idx" ON "error_questions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "error_questions_mastery_level_idx" ON "error_questions" USING btree ("mastery_level");--> statement-breakpoint
CREATE INDEX "stories_user_id_idx" ON "stories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stories_created_at_idx" ON "stories" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "story_images_story_id_idx" ON "story_images" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "story_words_user_id_idx" ON "story_words" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "story_words_word_idx" ON "story_words" USING btree ("word");--> statement-breakpoint
CREATE INDEX "story_words_user_word_idx" ON "story_words" USING btree ("user_id","word");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");