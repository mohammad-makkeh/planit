import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { coaches } from '@/db/schema'
import type { ProfileInput } from '@/lib/validation'

export type Coach = typeof coaches.$inferSelect

/** Auth entry point — deliberately not coach-scoped. */
export function findCoachByEmail(email: string): Promise<Coach | undefined> {
  return db.query.coaches.findFirst({ where: eq(coaches.email, email) })
}

export function getCoach(coachId: string): Promise<Coach | undefined> {
  return db.query.coaches.findFirst({ where: eq(coaches.id, coachId) })
}

export async function updateCoachProfile(coachId: string, input: ProfileInput): Promise<Coach> {
  const [updated] = await db
    .update(coaches)
    .set({
      name: input.name,
      title: input.title ?? null,
      phone: input.phone ?? null,
      email: input.email,
      brandColor: input.brandColor ?? null,
      logoUrl: input.logoUrl ?? null,
    })
    .where(eq(coaches.id, coachId))
    .returning()
  if (!updated) throw new Error('Coach not found')
  return updated
}
