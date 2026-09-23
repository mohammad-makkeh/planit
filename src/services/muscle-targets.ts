import 'server-only'
import { asc } from 'drizzle-orm'
import { db } from '@/db/client'
import { muscleTargets } from '@/db/schema'

export type MuscleTarget = typeof muscleTargets.$inferSelect

/** The global muscle target catalog (shared by every coach, edited in the database only). */
export function listMuscleTargets(): Promise<MuscleTarget[]> {
  return db.select().from(muscleTargets).orderBy(asc(muscleTargets.position), asc(muscleTargets.name))
}
