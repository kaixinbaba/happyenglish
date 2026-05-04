import { inArray } from 'drizzle-orm';

import { errorQuestionTagRel, errorQuestionTags } from '@/storage/database/shared/schema';
import { getDb } from '@/storage/database/db';

const MAX_TAG_LENGTH = 64;

export function normalizeQuestionTags(tags: string[]) {
  return [...new Set(tags.map(tag => tag.trim()).filter(Boolean))]
    .map(tag => tag.slice(0, MAX_TAG_LENGTH));
}

export async function attachTagsToQuestion(questionId: string, tags: string[]) {
  const normalizedTags = normalizeQuestionTags(tags);
  if (normalizedTags.length === 0) return;

  const db = await getDb();

  await db
    .insert(errorQuestionTags)
    .values(normalizedTags.map(tag => ({ tag })))
    .onConflictDoNothing({ target: errorQuestionTags.tag });

  const tagRows = await db
    .select({ id: errorQuestionTags.id })
    .from(errorQuestionTags)
    .where(inArray(errorQuestionTags.tag, normalizedTags));

  if (tagRows.length === 0) return;

  await db
    .insert(errorQuestionTagRel)
    .values(tagRows.map(({ id }) => ({ questionId, tagId: id })))
    .onConflictDoNothing({
      target: [errorQuestionTagRel.questionId, errorQuestionTagRel.tagId],
    });
}
