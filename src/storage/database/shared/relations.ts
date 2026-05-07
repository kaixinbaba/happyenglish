import { relations } from "drizzle-orm/relations";
import { users, stories, storyImages, storyWords } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
	stories: many(stories),
	storyWords: many(storyWords),
}));

export const storiesRelations = relations(stories, ({ one, many }) => ({
	user: one(users, { fields: [stories.userId], references: [users.id] }),
	storyImages: many(storyImages),
	storyWords: many(storyWords),
}));

export const storyImagesRelations = relations(storyImages, ({ one }) => ({
	story: one(stories, { fields: [storyImages.storyId], references: [stories.id] }),
}));

export const storyWordsRelations = relations(storyWords, ({ one }) => ({
	user: one(users, { fields: [storyWords.userId], references: [users.id] }),
	story: one(stories, { fields: [storyWords.storyId], references: [stories.id] }),
}));
