import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { warmupPresets } from '@/db/schema'

export type WarmupPreset = typeof warmupPresets.$inferSelect

export function listWarmups(coachId: string): Promise<WarmupPreset[]> {
  return db.query.warmupPresets.findMany({
    where: eq(warmupPresets.coachId, coachId),
    orderBy: [asc(warmupPresets.text)],
  })
}

export async function createWarmup(coachId: string, text: string): Promise<WarmupPreset> {
  const [created] = await db
    .insert(warmupPresets)
    .values({ coachId, text: text.trim() })
    .returning()
  if (!created) throw new Error('Insert returned no row')
  return created
}

export async function updateWarmup(
  coachId: string,
  id: string,
  text: string,
): Promise<WarmupPreset | undefined> {
  const [updated] = await db
    .update(warmupPresets)
    .set({ text: text.trim() })
    .where(and(eq(warmupPresets.id, id), eq(warmupPresets.coachId, coachId)))
    .returning()
  return updated
}

export async function deleteWarmup(coachId: string, id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(warmupPresets)
    .where(and(eq(warmupPresets.id, id), eq(warmupPresets.coachId, coachId)))
    .returning({ id: warmupPresets.id })
  return deleted !== undefined
}
