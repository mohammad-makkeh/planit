import 'server-only'
import { asc } from 'drizzle-orm'
import { db } from '@/db/client'
import { equipment } from '@/db/schema'

export type Equipment = typeof equipment.$inferSelect

/** The global equipment catalog (shared by every coach, edited in the database only). */
export function listEquipment(): Promise<Equipment[]> {
  return db.select().from(equipment).orderBy(asc(equipment.name))
}
