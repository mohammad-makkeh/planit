import 'server-only'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, isUniqueViolation } from '@/db/client'
import { clients, exercises, planRows, planSessions, plans } from '@/db/schema'
import type { WarmupLine } from '@/db/schema'

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

export type EditorRow = {
  id: string
  position: number
  sets: string | null
  reps: string | null
  speed: string | null
  oneRm: string | null
  rest: string | null
  note: string | null
  exercise: { id: string; name: string; imageUrl: string | null }
}

export type EditorSession = {
  id: string
  position: number
  label: string
  weekday: string | null
  focusNote: string | null
  warmupLines: WarmupLine[]
  cardioTime: string | null
  cardioHrm: string | null
  rows: EditorRow[]
}

export type EditorPlan = {
  id: string
  clientId: string
  title: string
  status: Plan['status']
  shareSlug: string | null
  updatedAt: Date
  client: { id: string; name: string }
  sessions: EditorSession[]
}

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Bump plans.updated_at — call from every session/row mutation. */
export async function touchPlan(executor: DbOrTx, planId: string): Promise<void> {
  await executor.update(plans).set({ updatedAt: new Date() }).where(eq(plans.id, planId))
}

export function getOwnedPlan(coachId: string, planId: string): Promise<Plan | undefined> {
  return db.query.plans.findFirst({
    where: and(eq(plans.id, planId), eq(plans.coachId, coachId), isNull(plans.deletedAt)),
  })
}

export async function getPlanForEditor(
  coachId: string,
  planId: string,
): Promise<EditorPlan | undefined> {
  const plan = await getOwnedPlan(coachId, planId)
  if (!plan) return undefined
  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, plan.clientId), eq(clients.coachId, coachId), isNull(clients.deletedAt)),
    columns: { id: true, name: true },
  })
  if (!client) return undefined

  const sessions = await db.query.planSessions.findMany({
    where: eq(planSessions.planId, planId),
    orderBy: [asc(planSessions.position)],
  })

  const rowRecords =
    sessions.length > 0
      ? await db
          .select({
            id: planRows.id,
            sessionId: planRows.sessionId,
            position: planRows.position,
            sets: planRows.sets,
            reps: planRows.reps,
            speed: planRows.speed,
            oneRm: planRows.oneRm,
            rest: planRows.rest,
            note: planRows.note,
            exerciseId: exercises.id,
            exerciseName: exercises.name,
            exerciseImageUrl: exercises.imageUrl,
          })
          .from(planRows)
          .innerJoin(exercises, eq(planRows.exerciseId, exercises.id))
          .where(inArray(planRows.sessionId, sessions.map((s) => s.id)))
          .orderBy(asc(planRows.position))
      : []

  const rowsBySession = new Map<string, EditorRow[]>()
  for (const r of rowRecords) {
    const list = rowsBySession.get(r.sessionId) ?? []
    list.push({
      id: r.id,
      position: r.position,
      sets: r.sets,
      reps: r.reps,
      speed: r.speed,
      oneRm: r.oneRm,
      rest: r.rest,
      note: r.note,
      exercise: { id: r.exerciseId, name: r.exerciseName, imageUrl: r.exerciseImageUrl },
    })
    rowsBySession.set(r.sessionId, list)
  }

  return {
    id: plan.id,
    clientId: plan.clientId,
    title: plan.title,
    status: plan.status,
    shareSlug: plan.shareSlug,
    updatedAt: plan.updatedAt,
    client,
    sessions: sessions.map((s) => ({
      id: s.id,
      position: s.position,
      label: s.label,
      weekday: s.weekday,
      focusNote: s.focusNote,
      warmupLines: s.warmupLines,
      cardioTime: s.cardioTime,
      cardioHrm: s.cardioHrm,
      rows: rowsBySession.get(s.id) ?? [],
    })),
  }
}

export async function createPlan(
  coachId: string,
  clientId: string,
): Promise<{ id: string } | undefined> {
  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, clientId), eq(clients.coachId, coachId), isNull(clients.deletedAt)),
  })
  if (!client) return undefined
  const title = `Plan – ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
  return db.transaction(async (tx) => {
    const [plan] = await tx.insert(plans).values({ coachId, clientId, title }).returning({ id: plans.id })
    if (!plan) throw new Error('Insert returned no row')
    await tx.insert(planSessions).values({ planId: plan.id, position: 1, label: 'Day 1' })
    return { id: plan.id }
  })
}

export async function updatePlanMeta(
  coachId: string,
  planId: string,
  input: { title?: string; status?: Plan['status'] },
): Promise<boolean> {
  const [updated] = await db
    .update(plans)
    .set(input)
    .where(and(eq(plans.id, planId), eq(plans.coachId, coachId), isNull(plans.deletedAt)))
    .returning({ id: plans.id })
  return updated !== undefined
}

export async function softDeletePlan(coachId: string, planId: string): Promise<boolean> {
  const [deleted] = await db
    .update(plans)
    .set({ deletedAt: new Date() })
    .where(and(eq(plans.id, planId), eq(plans.coachId, coachId), isNull(plans.deletedAt)))
    .returning({ id: plans.id })
  return deleted !== undefined
}

export async function duplicatePlan(
  coachId: string,
  planId: string,
  targetClientId?: string,
): Promise<{ id: string } | undefined> {
  const source = await getPlanForEditor(coachId, planId)
  if (!source) return undefined
  let clientId = source.clientId
  let title = `${source.title} (copy)`
  if (targetClientId && targetClientId !== source.clientId) {
    const target = await db.query.clients.findFirst({
      where: and(eq(clients.id, targetClientId), eq(clients.coachId, coachId), isNull(clients.deletedAt)),
    })
    if (!target) return undefined
    clientId = target.id
    title = source.title
  }
  return db.transaction(async (tx) => {
    const [plan] = await tx.insert(plans).values({ coachId, clientId, title }).returning({ id: plans.id })
    if (!plan) throw new Error('Insert returned no row')
    for (const s of source.sessions) {
      const [session] = await tx
        .insert(planSessions)
        .values({
          planId: plan.id,
          position: s.position,
          label: s.label,
          weekday: s.weekday,
          focusNote: s.focusNote,
          warmupLines: s.warmupLines,
          cardioTime: s.cardioTime,
          cardioHrm: s.cardioHrm,
        })
        .returning({ id: planSessions.id })
      if (!session) throw new Error('Insert returned no row')
      if (s.rows.length > 0) {
        await tx.insert(planRows).values(
          s.rows.map((r) => ({
            sessionId: session.id,
            position: r.position,
            exerciseId: r.exercise.id,
            sets: r.sets,
            reps: r.reps,
            speed: r.speed,
            oneRm: r.oneRm,
            rest: r.rest,
            note: r.note,
          })),
        )
      }
    }
    return { id: plan.id }
  })
}

export async function generateShareSlug(coachId: string, planId: string): Promise<string | undefined> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [updated] = await db
        .update(plans)
        .set({ shareSlug: nanoid(12) })
        .where(and(eq(plans.id, planId), eq(plans.coachId, coachId), isNull(plans.deletedAt)))
        .returning({ shareSlug: plans.shareSlug })
      return updated?.shareSlug ?? undefined
    } catch (e) {
      if (!isUniqueViolation(e) || attempt === 1) throw e
    }
  }
  return undefined
}

export async function revokeShareSlug(coachId: string, planId: string): Promise<boolean> {
  const [updated] = await db
    .update(plans)
    .set({ shareSlug: null })
    .where(and(eq(plans.id, planId), eq(plans.coachId, coachId), isNull(plans.deletedAt)))
    .returning({ id: plans.id })
  return updated !== undefined
}
