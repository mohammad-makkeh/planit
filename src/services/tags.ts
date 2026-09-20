import 'server-only'
import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { tags } from '@/db/schema'

export type Tag = typeof tags.$inferSelect

export function listTags(coachId: string): Promise<Tag[]> {
  return db.query.tags.findMany({ where: eq(tags.coachId, coachId), orderBy: [asc(tags.name)] })
}

export async function createTag(coachId: string, name: string): Promise<Tag> {
  const trimmed = name.trim()
  const [created] = await db
    .insert(tags)
    .values({ coachId, name: trimmed })
    .onConflictDoNothing()
    .returning()
  if (created) return created
  const existing = await db.query.tags.findFirst({
    where: and(eq(tags.coachId, coachId), sql`lower(${tags.name}) = lower(${trimmed})`),
  })
  if (!existing) throw new Error('Tag creation failed')
  return existing
}
