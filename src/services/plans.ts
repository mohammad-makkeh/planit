import 'server-only'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, isUniqueViolation } from '@/db/client'
import { clients, exercises, planRows, planSessions, plans } from '@/db/schema'
import type { WarmupLine } from '@/db/schema'
import type { PlanPatch } from '@/lib/validation'

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

/** Ownership helper: get session if owned by coach. */
async function getOwnedSession(coachId: string, sessionId: string) {
  const [record] = await db
    .select({ id: planSessions.id, planId: planSessions.planId, position: planSessions.position })
    .from(planSessions)
    .innerJoin(plans, eq(planSessions.planId, plans.id))
    .where(and(eq(planSessions.id, sessionId), eq(plans.coachId, coachId), isNull(plans.deletedAt)))
  return record
}

/** Ownership helper: get row if owned by coach. */
async function getOwnedRow(coachId: string, rowId: string) {
  const [record] = await db
    .select({ id: planRows.id, sessionId: planRows.sessionId, planId: planSessions.planId, position: planRows.position })
    .from(planRows)
    .innerJoin(planSessions, eq(planRows.sessionId, planSessions.id))
    .innerJoin(plans, eq(planSessions.planId, plans.id))
    .where(and(eq(planRows.id, rowId), eq(plans.coachId, coachId), isNull(plans.deletedAt)))
  return record
}

export async function applyPlanPatch(
  coachId: string,
  planId: string,
  patch: PlanPatch,
): Promise<boolean> {
  const plan = await getOwnedPlan(coachId, planId)
  if (!plan) return false

  const sessionRecords = await db.query.planSessions.findMany({
    where: eq(planSessions.planId, planId),
    columns: { id: true },
  })
  const sessionIds = new Set(sessionRecords.map((s) => s.id))

  const patchedSessionIds = Object.keys(patch.sessions ?? {})
  if (patchedSessionIds.some((id) => !sessionIds.has(id))) return false

  const patchedRowIds = Object.keys(patch.rows ?? {})
  if (patchedRowIds.length > 0) {
    if (sessionIds.size === 0) return false
    const ownedRows = await db
      .select({ id: planRows.id })
      .from(planRows)
      .where(and(inArray(planRows.id, patchedRowIds), inArray(planRows.sessionId, [...sessionIds])))
    if (ownedRows.length !== patchedRowIds.length) return false
  }

  await db.transaction(async (tx) => {
    if (patch.plan && Object.keys(patch.plan).length > 0) {
      await tx.update(plans).set(patch.plan).where(eq(plans.id, planId))
    }
    for (const [id, fields] of Object.entries(patch.sessions ?? {})) {
      if (Object.keys(fields).length > 0) {
        await tx.update(planSessions).set(fields).where(eq(planSessions.id, id))
      }
    }
    for (const [id, fields] of Object.entries(patch.rows ?? {})) {
      if (Object.keys(fields).length > 0) {
        await tx.update(planRows).set(fields).where(eq(planRows.id, id))
      }
    }
    await touchPlan(tx, planId)
  })
  return true
}

export async function createSession(coachId: string, planId: string): Promise<boolean> {
  const plan = await getOwnedPlan(coachId, planId)
  if (!plan) return false
  await db.transaction(async (tx) => {
    const [agg] = await tx
      .select({
        max: sql<number>`coalesce(max(${planSessions.position}), 0)::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(planSessions)
      .where(eq(planSessions.planId, planId))
    await tx.insert(planSessions).values({
      planId,
      position: (agg?.max ?? 0) + 1,
      label: `Day ${(agg?.count ?? 0) + 1}`,
    })
    await touchPlan(tx, planId)
  })
  return true
}

export async function duplicateSession(coachId: string, sessionId: string): Promise<boolean> {
  const owned = await getOwnedSession(coachId, sessionId)
  if (!owned) return false
  const source = await db.query.planSessions.findFirst({ where: eq(planSessions.id, sessionId) })
  if (!source) return false
  const rows = await db.query.planRows.findMany({
    where: eq(planRows.sessionId, sessionId),
    orderBy: [asc(planRows.position)],
  })
  await db.transaction(async (tx) => {
    const [agg] = await tx
      .select({ max: sql<number>`coalesce(max(${planSessions.position}), 0)::int` })
      .from(planSessions)
      .where(eq(planSessions.planId, owned.planId))
    const [copy] = await tx
      .insert(planSessions)
      .values({
        planId: owned.planId,
        position: (agg?.max ?? 0) + 1,
        label: `${source.label} (copy)`,
        weekday: source.weekday,
        focusNote: source.focusNote,
        warmupLines: source.warmupLines,
        cardioTime: source.cardioTime,
        cardioHrm: source.cardioHrm,
      })
      .returning({ id: planSessions.id })
    if (!copy) throw new Error('Insert returned no row')
    if (rows.length > 0) {
      await tx.insert(planRows).values(
        rows.map((r) => ({
          sessionId: copy.id,
          position: r.position,
          exerciseId: r.exerciseId,
          sets: r.sets,
          reps: r.reps,
          speed: r.speed,
          oneRm: r.oneRm,
          rest: r.rest,
          note: r.note,
        })),
      )
    }
    await touchPlan(tx, owned.planId)
  })
  return true
}

export async function deleteSession(coachId: string, sessionId: string): Promise<boolean> {
  const owned = await getOwnedSession(coachId, sessionId)
  if (!owned) return false
  await db.transaction(async (tx) => {
    await tx.delete(planSessions).where(eq(planSessions.id, sessionId))
    await touchPlan(tx, owned.planId)
  })
  return true
}

export async function reorderSessions(
  coachId: string,
  planId: string,
  orderedIds: string[],
): Promise<boolean> {
  const plan = await getOwnedPlan(coachId, planId)
  if (!plan) return false
  const existing = await db.query.planSessions.findMany({
    where: eq(planSessions.planId, planId),
    columns: { id: true },
  })
  const existingIds = new Set(existing.map((s) => s.id))
  const orderedSet = new Set(orderedIds)
  if (orderedSet.size !== orderedIds.length || orderedSet.size !== existingIds.size || orderedIds.some((id) => !existingIds.has(id))) {
    return false
  }
  await db.transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.update(planSessions).set({ position: index + 1 }).where(eq(planSessions.id, id))
    }
    await touchPlan(tx, planId)
  })
  return true
}

export async function createRow(
  coachId: string,
  sessionId: string,
  exerciseId: string,
): Promise<boolean> {
  const owned = await getOwnedSession(coachId, sessionId)
  if (!owned) return false
  const exercise = await db.query.exercises.findFirst({
    where: and(eq(exercises.id, exerciseId), eq(exercises.coachId, coachId)),
  })
  if (!exercise) return false
  await db.transaction(async (tx) => {
    const [agg] = await tx
      .select({ max: sql<number>`coalesce(max(${planRows.position}), 0)::int` })
      .from(planRows)
      .where(eq(planRows.sessionId, sessionId))
    await tx.insert(planRows).values({ sessionId, position: (agg?.max ?? 0) + 1, exerciseId })
    await touchPlan(tx, owned.planId)
  })
  return true
}

export async function swapRowExercise(
  coachId: string,
  rowId: string,
  exerciseId: string,
): Promise<boolean> {
  const owned = await getOwnedRow(coachId, rowId)
  if (!owned) return false
  const exercise = await db.query.exercises.findFirst({
    where: and(eq(exercises.id, exerciseId), eq(exercises.coachId, coachId)),
  })
  if (!exercise) return false
  await db.transaction(async (tx) => {
    await tx.update(planRows).set({ exerciseId }).where(eq(planRows.id, rowId))
    await touchPlan(tx, owned.planId)
  })
  return true
}

export async function duplicateRow(coachId: string, rowId: string): Promise<boolean> {
  const owned = await getOwnedRow(coachId, rowId)
  if (!owned) return false
  const source = await db.query.planRows.findFirst({ where: eq(planRows.id, rowId) })
  if (!source) return false
  await db.transaction(async (tx) => {
    // shift everything after the source down one slot, insert the copy right below
    await tx
      .update(planRows)
      .set({ position: sql`${planRows.position} + 1` })
      .where(and(eq(planRows.sessionId, source.sessionId), sql`${planRows.position} > ${source.position}`))
    await tx.insert(planRows).values({
      sessionId: source.sessionId,
      position: source.position + 1,
      exerciseId: source.exerciseId,
      sets: source.sets,
      reps: source.reps,
      speed: source.speed,
      oneRm: source.oneRm,
      rest: source.rest,
      note: source.note,
    })
    await touchPlan(tx, owned.planId)
  })
  return true
}

export async function deleteRow(coachId: string, rowId: string): Promise<boolean> {
  const owned = await getOwnedRow(coachId, rowId)
  if (!owned) return false
  await db.transaction(async (tx) => {
    await tx.delete(planRows).where(eq(planRows.id, rowId))
    await touchPlan(tx, owned.planId)
  })
  return true
}

export async function reorderRows(
  coachId: string,
  sessionId: string,
  orderedIds: string[],
): Promise<boolean> {
  const owned = await getOwnedSession(coachId, sessionId)
  if (!owned) return false
  const existing = await db.query.planRows.findMany({
    where: eq(planRows.sessionId, sessionId),
    columns: { id: true },
  })
  const existingIds = new Set(existing.map((r) => r.id))
  const orderedSet = new Set(orderedIds)
  if (orderedSet.size !== orderedIds.length || orderedSet.size !== existingIds.size || orderedIds.some((id) => !existingIds.has(id))) {
    return false
  }
  await db.transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.update(planRows).set({ position: index + 1 }).where(eq(planRows.id, id))
    }
    await touchPlan(tx, owned.planId)
  })
  return true
}
