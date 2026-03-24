import { pgTable, serial, timestamp, varchar, text, integer, index } from "drizzle-orm/pg-core"
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
	},
	(table) => [
		index("story_words_user_id_idx").on(table.userId),
		index("story_words_word_idx").on(table.word),
		index("story_words_user_word_idx").on(table.userId, table.word),
	]
);

// Types
export type User = typeof users.$inferSelect;
export type Story = typeof stories.$inferSelect;
export type StoryImage = typeof storyImages.$inferSelect;
export type StoryWord = typeof storyWords.$inferSelect;
