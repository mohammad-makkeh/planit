import 'server-only'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/db/client'
import { plans } from '@/db/schema'

export type Plan = typeof plans.$inferSelect

export function listPlansForClient(coachId: string, clientId: string): Promise<Plan[]> {
  return db.query.plans.findMany({
    where: and(
      eq(plans.coachId, coachId),
      eq(plans.clientId, clientId),
      isNull(plans.deletedAt),
    ),
    orderBy: [desc(plans.createdAt)],
  })
}
