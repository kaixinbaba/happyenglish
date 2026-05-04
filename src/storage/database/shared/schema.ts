import { pgTable, serial, timestamp, varchar, text, integer, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// System health check table (must be preserved)
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// Users table
export const users = pgTable(
	"users",
	{
		id: varchar("id", { length: 36 })
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		nickname: varchar("nickname", { length: 128 }).notNull(),
		avatarUrl: varchar("avatar_url", { length: 512 }),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	},
	(table) => [
		index("users_created_at_idx").on(table.createdAt),
	]
);

// Stories table
export const stories = pgTable(
	"stories",
	{
		id: varchar("id", { length: 36 })
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
		storyEn: text("story_en").notNull(),
		storyZh: text("story_zh").notNull(),
		ageGroup: varchar("age_group", { length: 32 }).notNull(),
		wordCount: integer("word_count").notNull(),
		imageCount: integer("image_count").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("stories_user_id_idx").on(table.userId),
		index("stories_created_at_idx").on(table.createdAt),
	]
);

// Story images table
export const storyImages = pgTable(
	"story_images",
	{
		id: varchar("id", { length: 36 })
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		storyId: varchar("story_id", { length: 36 }).notNull().references(() => stories.id, { onDelete: 'cascade' }),
		imageUrl: varchar("image_url", { length: 1024 }).notNull(),
		orderIndex: integer("order_index").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("story_images_story_id_idx").on(table.storyId),
	]
);

// Story words table (user learning records)
export const storyWords = pgTable(
	"story_words",
	{
		id: varchar("id", { length: 36 })
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
		word: varchar("word", { length: 128 }).notNull(),
		translation: varchar("translation", { length: 256 }),
		firstLearnedAt: timestamp("first_learned_at", { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
		lastLearnedAt: timestamp("last_learned_at", { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
		learnCount: integer("learn_count").notNull().default(1),
		// 错题集扩展字段
		errorCount: integer("error_count").notNull().default(0),
		masteryLevel: integer("mastery_level").notNull().default(50), // 0-100，数值越高掌握越好
		lastErrorAt: timestamp("last_error_at", { withTimezone: true, mode: 'string' }),
	},
	(table) => [
		index("story_words_user_id_idx").on(table.userId),
		index("story_words_word_idx").on(table.word),
		index("story_words_user_word_idx").on(table.userId, table.word),
	]
);

// Error questions table

export const errorQuestions = pgTable(
	"error_questions",
	{
		id: varchar("id", { length: 36 })
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
		type: varchar("type", { length: 32 }).notNull(), // 题型：spelling/word-choice/multiple-choice/grammar/translation/reading/custom
		content: jsonb("content").notNull(), // 题型对应的结构化内容
		correctAnswer: text("correct_answer").notNull(),
		userAnswer: text("user_answer"),
		errorReason: text("error_reason"), // 错误原因
		masteryLevel: integer("mastery_level").notNull().default(0), // 本题掌握度0-100
		lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true, mode: 'string' }),
		reviewCount: integer("review_count").notNull().default(0),
		lastResult: varchar("last_result", { length: 16 }), // 'correct' | 'wrong'
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("error_questions_user_id_idx").on(table.userId),
		index("error_questions_type_idx").on(table.type),
		index("error_questions_mastery_level_idx").on(table.masteryLevel),
		index("error_questions_review_count_idx").on(table.reviewCount),
		index("error_questions_last_result_idx").on(table.lastResult),
	]
);

// Error question tags table
export const errorQuestionTags = pgTable(
	"error_question_tags",
	{
		id: varchar("id", { length: 36 })
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		tag: varchar("tag", { length: 64 }).notNull(), // 知识点标签
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("error_question_tags_tag_idx").on(table.tag),
		uniqueIndex("error_question_tags_tag_unique").on(table.tag),
	]
);

// Error question tag relation table
export const errorQuestionTagRel = pgTable(
	"error_question_tag_rel",
	{
		id: varchar("id", { length: 36 })
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		questionId: varchar("question_id", { length: 36 }).notNull().references(() => errorQuestions.id, { onDelete: 'cascade' }),
		tagId: varchar("tag_id", { length: 36 }).notNull().references(() => errorQuestionTags.id, { onDelete: 'cascade' }),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("error_question_tag_rel_question_id_idx").on(table.questionId),
		index("error_question_tag_rel_tag_id_idx").on(table.tagId),
		uniqueIndex("error_question_tag_rel_question_tag_unique").on(table.questionId, table.tagId),
	]
);

// Error question word relation table
export const errorQuestionWordRel = pgTable(
	"error_question_word_rel",
	{
		id: varchar("id", { length: 36 })
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		questionId: varchar("question_id", { length: 36 }).notNull().references(() => errorQuestions.id, { onDelete: 'cascade' }),
		wordId: varchar("word_id", { length: 36 }).notNull().references(() => storyWords.id, { onDelete: 'cascade' }),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("error_question_word_rel_question_id_idx").on(table.questionId),
		index("error_question_word_rel_word_id_idx").on(table.wordId),
		index("error_question_word_rel_question_word_idx").on(table.questionId, table.wordId),
	]
);

// Review sessions table
export const reviewSessions = pgTable(
	"review_sessions",
	{
		id: varchar("id", { length: 36 })
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
		totalQuestions: integer("total_questions").notNull(), // 总题数
		completedQuestions: integer("completed_questions").notNull().default(0), // 已完成题数
		correctCount: integer("correct_count").notNull().default(0), // 答对题数
		wrongCount: integer("wrong_count").notNull().default(0), // 答错题数
		status: varchar("status", { length: 16 }).notNull().default('in_progress'), // in_progress, completed, cancelled
		startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("review_sessions_user_id_idx").on(table.userId),
		index("review_sessions_status_idx").on(table.status),
		index("review_sessions_started_at_idx").on(table.startedAt),
	]
);

// Review records table
export const reviewRecords = pgTable(
	"review_records",
	{
		id: varchar("id", { length: 36 })
			.primaryKey()
			.default(sql`gen_random_uuid()`),
		sessionId: varchar("session_id", { length: 36 }).notNull().references(() => reviewSessions.id, { onDelete: 'cascade' }),
		questionId: varchar("question_id", { length: 36 }).notNull().references(() => errorQuestions.id, { onDelete: 'cascade' }),
		userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
		result: varchar("result", { length: 16 }).notNull(), // correct, wrong
		previousMasteryLevel: integer("previous_mastery_level").notNull(), // 复习前掌握度
		newMasteryLevel: integer("new_mastery_level").notNull(), // 复习后掌握度
		orderIndex: integer("order_index").notNull().default(0), // 在复习会话中的顺序
		createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("review_records_session_id_idx").on(table.sessionId),
		index("review_records_question_id_idx").on(table.questionId),
		index("review_records_user_id_idx").on(table.userId),
		index("review_records_created_at_idx").on(table.createdAt),
	]
);

// Types
export type User = typeof users.$inferSelect;
export type Story = typeof stories.$inferSelect;
export type StoryImage = typeof storyImages.$inferSelect;
export type StoryWord = typeof storyWords.$inferSelect;
export type ErrorQuestion = typeof errorQuestions.$inferSelect;
export type ErrorQuestionTag = typeof errorQuestionTags.$inferSelect;
export type ErrorQuestionTagRel = typeof errorQuestionTagRel.$inferSelect;
export type ErrorQuestionWordRel = typeof errorQuestionWordRel.$inferSelect;
export type ReviewSession = typeof reviewSessions.$inferSelect;
export type ReviewRecord = typeof reviewRecords.$inferSelect;
