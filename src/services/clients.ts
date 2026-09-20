import 'server-only'
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { clients, plans } from '@/db/schema'
import type { ClientInput } from '@/lib/validation'

export type Client = typeof clients.$inferSelect
export type ClientListItem = Client & { planCount: number; lastActivityAt: Date }

const lastActivity = sql<Date>`greatest(${clients.updatedAt}, coalesce(max(${plans.updatedAt}), ${clients.updatedAt}))`

export async function listClients(coachId: string, search?: string): Promise<ClientListItem[]> {
  const filters = [eq(clients.coachId, coachId), isNull(clients.deletedAt)]
  const q = search?.trim()
  if (q) {
    const like = `%${q}%`
    const nameOrPhone = or(ilike(clients.name, like), ilike(clients.phone, like))
    if (nameOrPhone) filters.push(nameOrPhone)
  }
  const rows = await db
    .select({ client: clients, planCount: sql<number>`count(${plans.id})::int`, lastActivityAt: lastActivity })
    .from(clients)
    .leftJoin(plans, and(eq(plans.clientId, clients.id), isNull(plans.deletedAt)))
    .where(and(...filters))
    .groupBy(clients.id)
    .orderBy(desc(lastActivity))
  return rows.map((r) => ({ ...r.client, planCount: r.planCount, lastActivityAt: r.lastActivityAt }))
}

export function getClient(coachId: string, clientId: string): Promise<Client | undefined> {
  return db.query.clients.findFirst({
    where: and(eq(clients.id, clientId), eq(clients.coachId, coachId), isNull(clients.deletedAt)),
  })
}

function toRow(input: ClientInput) {
  return {
    name: input.name,
    phone: input.phone ?? null,
    age: input.age ?? null,
    weightKg: input.weightKg ?? null,
    heightCm: input.heightCm ?? null,
    notes: input.notes ?? null,
  }
}

export async function createClient(coachId: string, input: ClientInput): Promise<Client> {
  const [created] = await db.insert(clients).values({ coachId, ...toRow(input) }).returning()
  if (!created) throw new Error('Insert returned no row')
  return created
}

export async function updateClient(
  coachId: string,
  clientId: string,
  input: ClientInput,
): Promise<Client | undefined> {
  const [updated] = await db
    .update(clients)
    .set(toRow(input))
    .where(and(eq(clients.id, clientId), eq(clients.coachId, coachId), isNull(clients.deletedAt)))
    .returning()
  return updated
}

export async function softDeleteClient(coachId: string, clientId: string): Promise<boolean> {
  const [deleted] = await db
    .update(clients)
    .set({ deletedAt: new Date() })
    .where(and(eq(clients.id, clientId), eq(clients.coachId, coachId), isNull(clients.deletedAt)))
    .returning({ id: clients.id })
  return deleted !== undefined
}
