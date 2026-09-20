# Planit Plan Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the plan editor module — plan lifecycle (create/duplicate/status/share/delete), the session/row editor with 10s-debounced batched autosave, warm-up preset picker, exercise picker with inline move creation, dnd-kit reordering — and upgrade the client profile's plan list to fully actionable.

**Architecture:** No schema changes. `services/plans.ts` becomes the module engine (coach-scoped, every mutation touching `plans.updated_at`); one batched `applyPlanPatch` transaction is the autosave endpoint; every structural action returns a fresh `EditorPlan` payload that replaces the editor's local document. The editor is a client-component tree hydrated by one RSC fetch.

**Tech Stack:** existing foundation stack + `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

**Spec:** `docs/superpowers/specs/2026-09-20-planit-plan-editor-design.md` (parent: `2026-09-20-planit-design.md` — its Global Constraints bind here too)

## Global Constraints

- **No automated tests** (explicit user decision). Verify via `npm run typecheck`, `npm run lint`, `npm run build`, plus authenticated curl where SSR-visible; interactive flows are verified by the controller's browser capstone.
- Strict TypeScript, no `any` (use `unknown` + narrowing).
- Services are the ONLY consumers of `db/`; every service function takes `coachId: string` first and scopes every query by it; soft-deleted plans/clients excluded everywhere.
- **Base UI, not Radix**: zero `asChild`; trigger composition uses the `render` prop; never nest a button inside a component that renders a button.
- All plan-row measurement fields stay free-form text.
- Every structural mutation returns the fresh `EditorPlan` payload (see spec §2 "Structural-return rule").
- Every entity id crossing an action boundary is validated as a UUID before touching the DB.
- Design tokens only; mobile-first.
- Every commit message ends with this exact trailer line, on its own line in the commit BODY after a blank line: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- `.env.local` exists with live credentials — never print its contents. Never delete or mutate real seeded/user data during verification beyond what a task explicitly creates for itself.

## File Structure

```
src/services/plans.ts                       extended: editor payload, plan/session/row ops, patch
src/lib/validation.ts                       add: planMetaSchema, planPatchSchema (+ types)
src/actions/plan-editor.ts                  all module server actions
src/hooks/use-autosave.ts                   dirty buffer + 10s debounce + flush triggers
src/app/(app)/clients/[id]/plans/[planId]/page.tsx      editor RSC
src/app/(app)/clients/[id]/plans/[planId]/loading.tsx   skeleton
src/components/plans/plan-card-menu.tsx     card ⋯ menu (open/duplicate/status/share/delete)
src/components/plans/client-picker-dialog.tsx
src/components/plans/share-sheet.tsx        generate/copy/revoke (reused by editor header)
src/components/plans/new-plan-button.tsx    FAB: create + navigate
src/components/clients/plan-list.tsx        modified: linked cards + menu
src/app/(app)/clients/[id]/page.tsx         modified: pass clients list, FAB
src/components/plan-editor/plan-editor.tsx  root client component (document state)
src/components/plan-editor/editor-header.tsx
src/components/plan-editor/session-chips.tsx        dnd horizontal
src/components/plan-editor/session-panel.tsx
src/components/plan-editor/warmup-section.tsx
src/components/plan-editor/warmup-picker-sheet.tsx
src/components/plan-editor/exercise-row-card.tsx
src/components/plan-editor/exercise-picker-sheet.tsx
src/components/ui/sheet.tsx                 added via shadcn (or bottom-Dialog fallback)
```

---

### Task 1: Plan-level services + editor payload

**Files:**
- Modify: `src/services/plans.ts` (extend — keep the existing `Plan` type and `listPlansForClient`)

**Interfaces:**
- Consumes: schema tables, `isUniqueViolation` from `@/db/client`, `nanoid`
- Produces (from `@/services/plans`): `type EditorRow`, `type EditorSession`, `type EditorPlan`; `getPlanForEditor(coachId, planId): Promise<EditorPlan | undefined>`; `createPlan(coachId, clientId): Promise<{ id: string } | undefined>`; `updatePlanMeta(coachId, planId, input: { title?: string; status?: Plan['status'] }): Promise<boolean>`; `softDeletePlan(coachId, planId): Promise<boolean>`; `duplicatePlan(coachId, planId, targetClientId?): Promise<{ id: string } | undefined>`; `generateShareSlug(coachId, planId): Promise<string | undefined>`; `revokeShareSlug(coachId, planId): Promise<boolean>`; internal helpers `getOwnedPlan`, `touchPlan` (exported for Task 2's use within this file).

- [ ] **Step 1: Extend imports and add types/helpers to `src/services/plans.ts`**

Replace the file's import block with:

```ts
import 'server-only'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, isUniqueViolation } from '@/db/client'
import { clients, exercises, planRows, planSessions, plans } from '@/db/schema'
import type { WarmupLine } from '@/db/schema'
```

Below the existing `listPlansForClient`, add:

```ts
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
```

- [ ] **Step 2: Add `getPlanForEditor`**

```ts
export async function getPlanForEditor(
  coachId: string,
  planId: string,
): Promise<EditorPlan | undefined> {
  const plan = await getOwnedPlan(coachId, planId)
  if (!plan) return undefined
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, plan.clientId),
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
```

- [ ] **Step 3: Add plan lifecycle functions**

```ts
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
```

(`desc` stays used by the existing `listPlansForClient`; keep it imported.)

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit with trailer**

```bash
git add -A && git commit -m "feat: plan lifecycle services and editor payload"
```

---

### Task 2: Session/row services + applyPlanPatch

**Files:**
- Modify: `src/services/plans.ts`, `src/lib/validation.ts`

**Interfaces:**
- Consumes: Task 1 (`getOwnedPlan`, `touchPlan`, `EditorPlan` types)
- Produces:
  - `@/lib/validation`: `planMetaSchema` (`{ title?, status? }`), `planPatchSchema`, `type PlanMetaInput`, `type PlanPatch`
  - `@/services/plans`: `applyPlanPatch(coachId, planId, patch: PlanPatch): Promise<boolean>`; `createSession(coachId, planId)`, `duplicateSession(coachId, sessionId)`, `deleteSession(coachId, sessionId)`, `reorderSessions(coachId, planId, orderedIds: string[])`, `createRow(coachId, sessionId, exerciseId)`, `swapRowExercise(coachId, rowId, exerciseId)`, `duplicateRow(coachId, rowId)`, `deleteRow(coachId, rowId)`, `reorderRows(coachId, sessionId, orderedIds: string[])` — all returning `Promise<boolean>` (false = not found / not owned / invalid).

- [ ] **Step 1: Add schemas to `src/lib/validation.ts`**

```ts
export const planMetaSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    status: z.enum(['draft', 'active', 'completed']),
  })
  .partial()
export type PlanMetaInput = z.infer<typeof planMetaSchema>

const patchText = (max: number) => z.string().max(max).nullable()

export const planPatchSchema = z.object({
  plan: z.object({ title: z.string().trim().min(1).max(200) }).partial().optional(),
  sessions: z
    .record(
      z.string().uuid(),
      z
        .object({
          label: z.string().trim().min(1).max(120),
          weekday: z.string().max(20).nullable(),
          focusNote: patchText(500),
          warmupLines: z
            .array(z.object({ text: z.string().min(1).max(300), highlighted: z.boolean() }))
            .max(50),
          cardioTime: patchText(120),
          cardioHrm: patchText(120),
        })
        .partial(),
    )
    .optional(),
  rows: z
    .record(
      z.string().uuid(),
      z
        .object({
          sets: patchText(40),
          reps: patchText(40),
          speed: patchText(120),
          oneRm: patchText(120),
          rest: patchText(60),
          note: patchText(500),
        })
        .partial(),
    )
    .optional(),
})
export type PlanPatch = z.infer<typeof planPatchSchema>
```

- [ ] **Step 2: Add ownership helpers and `applyPlanPatch` to `src/services/plans.ts`**

```ts
import type { PlanPatch } from '@/lib/validation'
```

```ts
async function getOwnedSession(coachId: string, sessionId: string) {
  const [record] = await db
    .select({ id: planSessions.id, planId: planSessions.planId, position: planSessions.position })
    .from(planSessions)
    .innerJoin(plans, eq(planSessions.planId, plans.id))
    .where(and(eq(planSessions.id, sessionId), eq(plans.coachId, coachId), isNull(plans.deletedAt)))
  return record
}

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
```

- [ ] **Step 3: Add session operations**

```ts
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
  if (orderedIds.length !== existingIds.size || orderedIds.some((id) => !existingIds.has(id))) {
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
```

- [ ] **Step 4: Add row operations**

```ts
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
  if (orderedIds.length !== existingIds.size || orderedIds.some((id) => !existingIds.has(id))) {
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
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit with trailer**

```bash
git add -A && git commit -m "feat: session and row services with batched plan patch"
```

---

### Task 3: Server actions

**Files:**
- Create: `src/actions/plan-editor.ts`

**Interfaces:**
- Consumes: Tasks 1–2 services, `@/lib/validation` (`planMetaSchema`, `planPatchSchema`), `@/lib/action-result`, `@/lib/session`
- Produces (from `@/actions/plan-editor`), all `Promise<ActionResult<…>>`:
  - `createPlanAction(clientId): <{ id: string }>`
  - `duplicatePlanAction(planId, targetClientId?): <{ id: string }>`
  - `deletePlanAction(planId): <null>`
  - `updatePlanMetaAction(planId, input: unknown): <EditorPlan>`
  - `generateShareSlugAction(planId): <{ slug: string }>`
  - `revokeShareSlugAction(planId): <null>`
  - `applyPlanPatchAction(planId, input: unknown): <null>`
  - `createSessionAction(planId)`, `duplicateSessionAction(planId, sessionId)`, `deleteSessionAction(planId, sessionId)`, `reorderSessionsAction(planId, orderedIds: string[])` — all `<EditorPlan>`
  - `createRowAction(planId, sessionId, exerciseId)`, `swapRowExerciseAction(planId, rowId, exerciseId)`, `duplicateRowAction(planId, rowId)`, `deleteRowAction(planId, rowId)`, `reorderRowsAction(planId, sessionId, orderedIds: string[])` — all `<EditorPlan>`

- [ ] **Step 1: Write `src/actions/plan-editor.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { err, fromZod, ok, tryAction, type ActionResult } from '@/lib/action-result'
import { requireCoachId } from '@/lib/session'
import { planMetaSchema, planPatchSchema } from '@/lib/validation'
import {
  applyPlanPatch,
  createPlan,
  createRow,
  createSession,
  deleteRow,
  deleteSession,
  duplicatePlan,
  duplicateRow,
  duplicateSession,
  generateShareSlug,
  getPlanForEditor,
  reorderRows,
  reorderSessions,
  revokeShareSlug,
  softDeletePlan,
  swapRowExercise,
  updatePlanMeta,
  type EditorPlan,
} from '@/services/plans'

const uuid = z.string().uuid()
const uuidList = z.array(uuid).min(1).max(200)

function isUuid(value: string): boolean {
  return uuid.safeParse(value).success
}

/** Fetch the fresh payload after a structural mutation and revalidate the profile. */
async function freshPayload(coachId: string, planId: string): Promise<ActionResult<EditorPlan>> {
  const payload = await getPlanForEditor(coachId, planId)
  if (!payload) return err('not_found', 'Plan not found.')
  revalidatePath(`/clients/${payload.clientId}`)
  return ok(payload)
}

export async function createPlanAction(clientId: string): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(clientId)) return err('validation', 'Invalid id.')
    const created = await createPlan(coachId, clientId)
    if (!created) return err('not_found', 'Client not found.')
    revalidatePath(`/clients/${clientId}`)
    return ok(created)
  })
}

export async function duplicatePlanAction(
  planId: string,
  targetClientId?: string,
): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || (targetClientId !== undefined && !isUuid(targetClientId))) {
      return err('validation', 'Invalid id.')
    }
    const created = await duplicatePlan(coachId, planId, targetClientId)
    if (!created) return err('not_found', 'Plan not found.')
    revalidatePath('/')
    return ok(created)
  })
}

export async function deletePlanAction(planId: string): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId)) return err('validation', 'Invalid id.')
    const deleted = await softDeletePlan(coachId, planId)
    if (!deleted) return err('not_found', 'Plan not found.')
    revalidatePath('/')
    return ok(null)
  })
}

export async function updatePlanMetaAction(
  planId: string,
  input: unknown,
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId)) return err('validation', 'Invalid id.')
    const parsed = planMetaSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const updated = await updatePlanMeta(coachId, planId, parsed.data)
    if (!updated) return err('not_found', 'Plan not found.')
    return freshPayload(coachId, planId)
  })
}

export async function generateShareSlugAction(
  planId: string,
): Promise<ActionResult<{ slug: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId)) return err('validation', 'Invalid id.')
    const slug = await generateShareSlug(coachId, planId)
    if (!slug) return err('not_found', 'Plan not found.')
    revalidatePath('/')
    return ok({ slug })
  })
}

export async function revokeShareSlugAction(planId: string): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId)) return err('validation', 'Invalid id.')
    const revoked = await revokeShareSlug(coachId, planId)
    if (!revoked) return err('not_found', 'Plan not found.')
    revalidatePath('/')
    return ok(null)
  })
}

export async function applyPlanPatchAction(
  planId: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId)) return err('validation', 'Invalid id.')
    const parsed = planPatchSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const applied = await applyPlanPatch(coachId, planId, parsed.data)
    if (!applied) return err('not_found', 'Plan not found.')
    return ok(null)
  })
}

export async function createSessionAction(planId: string): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId)) return err('validation', 'Invalid id.')
    const done = await createSession(coachId, planId)
    if (!done) return err('not_found', 'Plan not found.')
    return freshPayload(coachId, planId)
  })
}

export async function duplicateSessionAction(
  planId: string,
  sessionId: string,
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || !isUuid(sessionId)) return err('validation', 'Invalid id.')
    const done = await duplicateSession(coachId, sessionId)
    if (!done) return err('not_found', 'Session not found.')
    return freshPayload(coachId, planId)
  })
}

export async function deleteSessionAction(
  planId: string,
  sessionId: string,
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || !isUuid(sessionId)) return err('validation', 'Invalid id.')
    const done = await deleteSession(coachId, sessionId)
    if (!done) return err('not_found', 'Session not found.')
    return freshPayload(coachId, planId)
  })
}

export async function reorderSessionsAction(
  planId: string,
  orderedIds: string[],
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || !uuidList.safeParse(orderedIds).success) {
      return err('validation', 'Invalid ids.')
    }
    const done = await reorderSessions(coachId, planId, orderedIds)
    if (!done) return err('not_found', 'Plan not found.')
    return freshPayload(coachId, planId)
  })
}

export async function createRowAction(
  planId: string,
  sessionId: string,
  exerciseId: string,
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || !isUuid(sessionId) || !isUuid(exerciseId)) {
      return err('validation', 'Invalid id.')
    }
    const done = await createRow(coachId, sessionId, exerciseId)
    if (!done) return err('not_found', 'Session or move not found.')
    return freshPayload(coachId, planId)
  })
}

export async function swapRowExerciseAction(
  planId: string,
  rowId: string,
  exerciseId: string,
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || !isUuid(rowId) || !isUuid(exerciseId)) {
      return err('validation', 'Invalid id.')
    }
    const done = await swapRowExercise(coachId, rowId, exerciseId)
    if (!done) return err('not_found', 'Row or move not found.')
    return freshPayload(coachId, planId)
  })
}

export async function duplicateRowAction(
  planId: string,
  rowId: string,
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || !isUuid(rowId)) return err('validation', 'Invalid id.')
    const done = await duplicateRow(coachId, rowId)
    if (!done) return err('not_found', 'Row not found.')
    return freshPayload(coachId, planId)
  })
}

export async function deleteRowAction(
  planId: string,
  rowId: string,
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || !isUuid(rowId)) return err('validation', 'Invalid id.')
    const done = await deleteRow(coachId, rowId)
    if (!done) return err('not_found', 'Row not found.')
    return freshPayload(coachId, planId)
  })
}

export async function reorderRowsAction(
  planId: string,
  sessionId: string,
  orderedIds: string[],
): Promise<ActionResult<EditorPlan>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId) || !isUuid(sessionId) || !uuidList.safeParse(orderedIds).success) {
      return err('validation', 'Invalid ids.')
    }
    const done = await reorderRows(coachId, sessionId, orderedIds)
    if (!done) return err('not_found', 'Session not found.')
    return freshPayload(coachId, planId)
  })
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit with trailer**

```bash
git add -A && git commit -m "feat: plan editor server actions"
```

---

### Task 4: Plan list upgrade (profile) + share sheet + client picker

**Files:**
- Create: `src/components/plans/share-sheet.tsx`, `src/components/plans/client-picker-dialog.tsx`, `src/components/plans/plan-card-menu.tsx`, `src/components/plans/new-plan-button.tsx`
- Modify: `src/components/clients/plan-list.tsx`, `src/app/(app)/clients/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 3 actions, `@/services/clients` (`listClients` — type-only where client-side), existing `EmptyState`/`Fab`/shadcn components
- Produces: `<ShareSheet open onOpenChange planId shareSlug onChanged(slug: string | null) />` (reused by Task 5's editor header), `<ClientPickerDialog open onOpenChange clients excludeClientId onPick(clientId) />` with `type PickerClient = { id: string; name: string }`, `<PlanCardMenu plan clients currentClientId />`, `<NewPlanButton clientId />`.

- [ ] **Step 1: Write `src/components/plans/share-sheet.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Check, Copy, Link2, Link2Off } from 'lucide-react'
import { toast } from 'sonner'
import { generateShareSlugAction, revokeShareSlugAction } from '@/actions/plan-editor'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export function ShareSheet({
  open,
  onOpenChange,
  planId,
  shareSlug,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  shareSlug: string | null
  onChanged: (slug: string | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = shareSlug ? `${window.location.origin}/p/${shareSlug}` : null

  async function generate() {
    setBusy(true)
    const result = await generateShareSlugAction(planId)
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    onChanged(result.data.slug)
  }

  async function revoke() {
    setBusy(true)
    const result = await revokeShareSlugAction(planId)
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    onChanged(null)
    toast.success('Link revoked')
  }

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy — long-press the link to copy it.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share plan</DialogTitle>
        </DialogHeader>
        {url ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={url} className="text-xs" />
              <Button variant="outline" size="icon" onClick={() => void copy()} aria-label="Copy link">
                {copied ? <Check className="size-4 text-brand" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can view the plan. It always shows the latest saved version.
            </p>
            <Button variant="outline" className="w-full text-destructive" onClick={() => void revoke()} disabled={busy}>
              <Link2Off className="size-4" /> Revoke link
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Create a private link your client can open on their phone.
            </p>
            <Button className="w-full" onClick={() => void generate()} disabled={busy}>
              <Link2 className="size-4" /> {busy ? 'Creating…' : 'Create share link'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Write `src/components/plans/client-picker-dialog.tsx`**

```tsx
'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { initials } from '@/lib/format'

export type PickerClient = { id: string; name: string }

export function ClientPickerDialog({
  open,
  onOpenChange,
  clients,
  excludeClientId,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: PickerClient[]
  excludeClientId: string
  onPick: (clientId: string) => void
}) {
  const options = clients.filter((c) => c.id !== excludeClientId)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Copy plan to…</DialogTitle>
        </DialogHeader>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other clients yet.</p>
        ) : (
          <div className="space-y-1">
            {options.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onPick(c.id)}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-accent/50"
              >
                <Avatar className="size-9">
                  <AvatarFallback className="bg-brand/10 text-sm font-semibold text-brand">
                    {initials(c.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Write `src/components/plans/plan-card-menu.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Link2, MoreVertical, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import {
  deletePlanAction, duplicatePlanAction, updatePlanMetaAction,
} from '@/actions/plan-editor'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Plan } from '@/services/plans'
import { ClientPickerDialog, type PickerClient } from './client-picker-dialog'
import { ShareSheet } from './share-sheet'

const NEXT_STATUS: Record<Plan['status'], Plan['status']> = {
  draft: 'active',
  active: 'completed',
  completed: 'draft',
}

export function PlanCardMenu({
  plan,
  clients,
  currentClientId,
}: {
  plan: { id: string; title: string; status: Plan['status']; shareSlug: string | null }
  clients: PickerClient[]
  currentClientId: string
}) {
  const router = useRouter()
  const [shareOpen, setShareOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [slug, setSlug] = useState(plan.shareSlug)
  const [busy, setBusy] = useState(false)

  async function duplicateInPlace() {
    const result = await duplicatePlanAction(plan.id)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success('Plan duplicated')
    router.refresh()
  }

  async function duplicateTo(clientId: string) {
    setPickerOpen(false)
    const result = await duplicatePlanAction(plan.id, clientId)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success('Plan copied')
    router.push(`/clients/${clientId}`)
  }

  async function cycleStatus() {
    const result = await updatePlanMetaAction(plan.id, { status: NEXT_STATUS[plan.status] })
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    router.refresh()
  }

  async function onDelete() {
    setBusy(true)
    const result = await deletePlanAction(plan.id)
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success('Plan deleted')
    setDeleteOpen(false)
    router.refresh()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Plan actions">
              <MoreVertical className="size-5" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void duplicateInPlace()}>
            <Copy className="size-4" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPickerOpen(true)}>
            <UserPlus className="size-4" /> Copy to another client
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void cycleStatus()}>
            Mark as {NEXT_STATUS[plan.status]}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShareOpen(true)}>
            <Link2 className="size-4" /> Share
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" /> Delete plan
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        planId={plan.id}
        shareSlug={slug}
        onChanged={setSlug}
      />
      <ClientPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        clients={clients}
        excludeClientId={currentClientId}
        onPick={(clientId) => void duplicateTo(clientId)}
      />
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {plan.title}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The plan will no longer appear in Planit, and its share link will stop working.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void onDelete()} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 4: Write `src/components/plans/new-plan-button.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createPlanAction } from '@/actions/plan-editor'
import { Fab } from '@/components/shell/fab'

export function NewPlanButton({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function create() {
    if (busy) return
    setBusy(true)
    const result = await createPlanAction(clientId)
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    router.push(`/clients/${clientId}/plans/${result.data.id}`)
  }

  return <Fab label={busy ? 'Creating…' : 'New plan'} onClick={() => void create()} />
}
```

- [ ] **Step 5: Replace `src/components/clients/plan-list.tsx`**

```tsx
import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { EmptyState } from '@/components/shell/empty-state'
import { PlanCardMenu } from '@/components/plans/plan-card-menu'
import type { PickerClient } from '@/components/plans/client-picker-dialog'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import type { Plan } from '@/services/plans'

const STATUS_STYLES: Record<Plan['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-brand/10 text-brand',
  completed: 'bg-secondary text-secondary-foreground',
}

export function PlanList({
  plans,
  clients,
  clientId,
}: {
  plans: Plan[]
  clients: PickerClient[]
  clientId: string
}) {
  if (plans.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="size-8 text-muted-foreground" />}
        title="No plans yet"
        description="Create the first plan with the button below."
      />
    )
  }
  return (
    <div className="space-y-3">
      {plans.map((plan) => (
        <div key={plan.id} className="flex items-center gap-2 rounded-2xl border bg-card p-2 pl-4">
          <Link href={`/clients/${clientId}/plans/${plan.id}`} className="min-w-0 flex-1 py-2">
            <p className="truncate font-semibold">{plan.title}</p>
            <p className="text-xs text-muted-foreground">
              Created {formatDate(plan.createdAt)} · Updated {formatDate(plan.updatedAt)}
            </p>
          </Link>
          <Badge className={STATUS_STYLES[plan.status]}>{plan.status}</Badge>
          <PlanCardMenu
            plan={{ id: plan.id, title: plan.title, status: plan.status, shareSlug: plan.shareSlug }}
            clients={clients}
            currentClientId={clientId}
          />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Update `src/app/(app)/clients/[id]/page.tsx`**

Add imports:

```tsx
import { NewPlanButton } from '@/components/plans/new-plan-button'
import { listClients } from '@/services/clients'
```

Fetch the picker list alongside the existing queries (after `getClient`):

```tsx
const [clientPlans, allClients] = await Promise.all([
  listPlansForClient(coachId, id),
  listClients(coachId),
])
```

(replacing the existing `listPlansForClient` call), pass the new props:

```tsx
<PlanList
  plans={clientPlans}
  clients={allClients.map((c) => ({ id: c.id, name: c.name }))}
  clientId={client.id}
/>
```

and render `<NewPlanButton clientId={client.id} />` just before the closing fragment (after the `</div>` that closes the page body).

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint && npm run build`; then with the dev server and an authenticated cookie, curl the client profile page and confirm it still renders (HTTP 200, plan section present). Interactive menu flows are covered by the controller capstone.

- [ ] **Step 8: Commit with trailer**

```bash
git add -A && git commit -m "feat: actionable plan list with share, duplicate, and create"
```

---

### Task 5: Editor core — route, autosave hook, header, session chips

**Files:**
- Create: `src/hooks/use-autosave.ts`, `src/components/plan-editor/plan-editor.tsx`, `src/components/plan-editor/editor-header.tsx`, `src/components/plan-editor/session-chips.tsx`, `src/app/(app)/clients/[id]/plans/[planId]/page.tsx`, `src/app/(app)/clients/[id]/plans/[planId]/loading.tsx`
- Modify: `package.json` (dnd-kit deps)

**Interfaces:**
- Consumes: Tasks 3–4 (`plan-editor` actions, `ShareSheet`, `ClientPickerDialog`), services (type-only in client components)
- Produces:
  - `@/hooks/use-autosave`: `useAutosave(planId)` → `{ status: 'saved'|'dirty'|'saving', queueField(kind: 'plan'|'session'|'row', id, fields), flush(): Promise<boolean>, runStructural<T>(fn: () => Promise<T>): Promise<T> }`
  - `<PlanEditor initial exercises tags warmups />` — the root; it exposes to child components (Tasks 6–7 consume these props): `session` (active `EditorSession`), `onSessionField(sessionId, fields)`, `onStructural(result-promise)` pattern via `run` + `applyResult` described below.
  - The active-session content area renders a temporary placeholder `<div>` that Task 6 replaces with `<SessionPanel …/>`.

- [ ] **Step 1: Install dnd-kit**

```bash
npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Write `src/hooks/use-autosave.ts`**

```ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { applyPlanPatchAction } from '@/actions/plan-editor'
import type { PlanPatch } from '@/lib/validation'

export type SaveStatus = 'saved' | 'dirty' | 'saving'

type FieldPatch = Record<string, unknown>

const DEBOUNCE_MS = 10_000

type Buffer = { plan: FieldPatch; sessions: Map<string, FieldPatch>; rows: Map<string, FieldPatch> }

function emptyBuffer(): Buffer {
  return { plan: {}, sessions: new Map(), rows: new Map() }
}

function mergeMaps(
  base: Record<string, FieldPatch> | undefined,
  overlay: Map<string, FieldPatch>,
): Map<string, FieldPatch> {
  const merged = new Map<string, FieldPatch>(Object.entries(base ?? {}))
  for (const [id, fields] of overlay) merged.set(id, { ...(merged.get(id) ?? {}), ...fields })
  return merged
}

export function useAutosave(planId: string) {
  const [status, setStatus] = useState<SaveStatus>('saved')
  const buffer = useRef<Buffer>(emptyBuffer())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef<Promise<boolean> | null>(null)

  const hasPending = useCallback(() => {
    const b = buffer.current
    return Object.keys(b.plan).length > 0 || b.sessions.size > 0 || b.rows.size > 0
  }, [])

  const flush = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return inFlight.current
    if (!hasPending()) return true
    const b = buffer.current
    const patch: PlanPatch = {
      plan: Object.keys(b.plan).length > 0 ? (b.plan as PlanPatch['plan']) : undefined,
      sessions: b.sessions.size > 0 ? (Object.fromEntries(b.sessions) as PlanPatch['sessions']) : undefined,
      rows: b.rows.size > 0 ? (Object.fromEntries(b.rows) as PlanPatch['rows']) : undefined,
    }
    buffer.current = emptyBuffer()
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    setStatus('saving')
    const run = (async () => {
      const result = await applyPlanPatchAction(planId, patch)
      if (!result.ok) {
        // put the failed patch back UNDER any edits made meanwhile (newest wins)
        const later = buffer.current
        buffer.current = {
          plan: { ...(patch.plan ?? {}), ...later.plan },
          sessions: mergeMaps(patch.sessions, later.sessions),
          rows: mergeMaps(patch.rows, later.rows),
        }
        setStatus('dirty')
        toast.error('Could not save — will retry. Check your connection.')
        return false
      }
      setStatus(hasPending() ? 'dirty' : 'saved')
      return true
    })()
    inFlight.current = run
    const outcome = await run
    inFlight.current = null
    return outcome
  }, [planId, hasPending])

  const queueField = useCallback(
    (kind: 'plan' | 'session' | 'row', id: string, fields: FieldPatch) => {
      const b = buffer.current
      if (kind === 'plan') {
        b.plan = { ...b.plan, ...fields }
      } else {
        const map = kind === 'session' ? b.sessions : b.rows
        map.set(id, { ...(map.get(id) ?? {}), ...fields })
      }
      setStatus('dirty')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), DEBOUNCE_MS)
    },
    [flush],
  )

  const runStructural = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      await flush()
      return fn()
    },
    [flush],
  )

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden') void flush()
    }
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (hasPending() || inFlight.current) e.preventDefault()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onBeforeUnload)
      void flush()
    }
  }, [flush, hasPending])

  return { status, queueField, flush, runStructural }
}
```

- [ ] **Step 3: Write `src/components/plan-editor/editor-header.tsx`**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, Link2, MoreVertical, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deletePlanAction, duplicatePlanAction } from '@/actions/plan-editor'
import { ShareSheet } from '@/components/plans/share-sheet'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { SaveStatus } from '@/hooks/use-autosave'
import { cn } from '@/lib/utils'
import type { EditorPlan } from '@/services/plans'

const SAVE_LABEL: Record<SaveStatus, string> = {
  saved: 'Saved ✓',
  saving: 'Saving…',
  dirty: 'Unsaved changes',
}

export function EditorHeader({
  plan,
  saveStatus,
  onTitleChange,
  onStatusChange,
  onSave,
  onShareChanged,
}: {
  plan: EditorPlan
  saveStatus: SaveStatus
  onTitleChange: (title: string) => void
  onStatusChange: (status: EditorPlan['status']) => void
  onSave: () => void
  onShareChanged: (slug: string | null) => void
}) {
  const router = useRouter()
  const [shareOpen, setShareOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function duplicate() {
    const result = await duplicatePlanAction(plan.id)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success('Duplicated — you are now editing the copy')
    router.push(`/clients/${plan.clientId}/plans/${result.data.id}`)
  }

  async function onDelete() {
    setBusy(true)
    const result = await deletePlanAction(plan.id)
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success('Plan deleted')
    router.push(`/clients/${plan.clientId}`)
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="flex items-center gap-1 px-2 py-2 md:px-6">
        <Link
          href={`/clients/${plan.clientId}`}
          className="flex items-center gap-1 p-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> {plan.client.name}
        </Link>
        <span
          className={cn(
            'ml-auto text-xs',
            saveStatus === 'dirty' ? 'text-brand' : 'text-muted-foreground',
          )}
        >
          {SAVE_LABEL[saveStatus]}
        </span>
        <Button size="sm" variant="outline" onClick={onSave} disabled={saveStatus === 'saving'}>
          Save
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Plan actions">
                <MoreVertical className="size-5" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void duplicate()}>
              <Copy className="size-4" /> Duplicate plan
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setShareOpen(true)}>
              <Link2 className="size-4" /> Share
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" /> Delete plan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3 md:px-8">
        <input
          value={plan.title}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="Plan title"
          className="min-w-0 flex-1 bg-transparent text-xl font-bold tracking-tight outline-none placeholder:text-muted-foreground"
          placeholder="Plan title"
        />
        <Select value={plan.status} onValueChange={(v) => onStatusChange(v as EditorPlan['status'])}>
          <SelectTrigger className="w-32" size="sm" aria-label="Plan status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        planId={plan.id}
        shareSlug={plan.shareSlug}
        onChanged={onShareChanged}
      />
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {plan.title}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The plan will no longer appear in Planit, and its share link will stop working.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void onDelete()} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
```

(If the generated `SelectTrigger` has no `size` prop in this shadcn generation, drop the `size="sm"` attribute and record the adaptation.)

- [ ] **Step 4: Write `src/components/plan-editor/session-chips.tsx`**

```tsx
'use client'

import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EditorSession } from '@/services/plans'

function SessionChip({
  session,
  active,
  onSelect,
}: {
  session: EditorSession
  active: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: session.id,
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'shrink-0 touch-none rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
        active ? 'border-brand bg-brand text-brand-foreground' : 'bg-card text-muted-foreground',
        isDragging && 'z-10 opacity-80',
      )}
      {...attributes}
      {...listeners}
    >
      {session.label}
    </button>
  )
}

export function SessionChips({
  sessions,
  activeSessionId,
  onSelect,
  onAdd,
  onReorder,
  adding,
}: {
  sessions: EditorSession[]
  activeSessionId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onReorder: (orderedIds: string[]) => void
  adding: boolean
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = sessions.map((s) => s.id)
    const reordered = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    onReorder(reordered)
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 md:px-8 [-ms-overflow-style:none] [scrollbar-width:none]">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sessions.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          {sessions.map((s) => (
            <SessionChip
              key={s.id}
              session={s}
              active={s.id === activeSessionId}
              onSelect={() => onSelect(s.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={onAdd}
        disabled={adding}
        aria-label="Add session"
        className="flex size-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground hover:bg-accent/50"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Write `src/components/plan-editor/plan-editor.tsx`**

```tsx
'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import {
  createSessionAction, reorderSessionsAction, updatePlanMetaAction,
} from '@/actions/plan-editor'
import type { TagOption } from '@/components/library/tag-multi-select'
import { useAutosave } from '@/hooks/use-autosave'
import type { ActionResult } from '@/lib/action-result'
import type { ExerciseWithTags } from '@/services/exercises'
import type { EditorPlan, EditorSession } from '@/services/plans'
import type { WarmupPreset } from '@/services/warmups'
import { EditorHeader } from './editor-header'
import { SessionChips } from './session-chips'

export type SessionFieldPatch = Partial<
  Pick<EditorSession, 'label' | 'weekday' | 'focusNote' | 'warmupLines' | 'cardioTime' | 'cardioHrm'>
>

export function PlanEditor({
  initial,
  exercises,
  tags,
  warmups,
}: {
  initial: EditorPlan
  exercises: ExerciseWithTags[]
  tags: TagOption[]
  warmups: WarmupPreset[]
}) {
  const [doc, setDoc] = useState<EditorPlan>(initial)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    initial.sessions[0]?.id ?? null,
  )
  const [structuralBusy, setStructuralBusy] = useState(false)
  const { status, queueField, flush, runStructural } = useAutosave(doc.id)

  /** Replace the document with a structural action's fresh payload. */
  const applyResult = useCallback((result: ActionResult<EditorPlan>): boolean => {
    if (!result.ok) {
      toast.error(result.error.message)
      return false
    }
    setDoc(result.data)
    setActiveSessionId((current) =>
      current && result.data.sessions.some((s) => s.id === current)
        ? current
        : (result.data.sessions[0]?.id ?? null),
    )
    return true
  }, [])

  /** Structural op wrapper: flush pending edits, run, apply payload. */
  const structural = useCallback(
    async (fn: () => Promise<ActionResult<EditorPlan>>) => {
      if (structuralBusy) return
      setStructuralBusy(true)
      try {
        const result = await runStructural(fn)
        applyResult(result)
      } finally {
        setStructuralBusy(false)
      }
    },
    [applyResult, runStructural, structuralBusy],
  )

  const setTitle = useCallback(
    (title: string) => {
      setDoc((d) => ({ ...d, title }))
      queueField('plan', initial.id, { title })
    },
    [initial.id, queueField],
  )

  const setStatus = useCallback(
    (status: EditorPlan['status']) => {
      void structural(() => updatePlanMetaAction(doc.id, { status }))
    },
    [doc.id, structural],
  )

  const setSessionField = useCallback(
    (sessionId: string, fields: SessionFieldPatch) => {
      setDoc((d) => ({
        ...d,
        sessions: d.sessions.map((s) => (s.id === sessionId ? { ...s, ...fields } : s)),
      }))
      queueField('session', sessionId, fields)
    },
    [queueField],
  )

  const setRowField = useCallback(
    (sessionId: string, rowId: string, fields: Record<string, string | null>) => {
      setDoc((d) => ({
        ...d,
        sessions: d.sessions.map((s) =>
          s.id === sessionId
            ? { ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, ...fields } : r)) }
            : s,
        ),
      }))
      queueField('row', rowId, fields)
    },
    [queueField],
  )

  const activeSession = doc.sessions.find((s) => s.id === activeSessionId) ?? null

  return (
    <div className="min-h-dvh">
      <EditorHeader
        plan={doc}
        saveStatus={status}
        onTitleChange={setTitle}
        onStatusChange={setStatus}
        onSave={() => void flush()}
        onShareChanged={(slug) => setDoc((d) => ({ ...d, shareSlug: slug }))}
      />
      <SessionChips
        sessions={doc.sessions}
        activeSessionId={activeSessionId}
        onSelect={setActiveSessionId}
        onAdd={() => void structural(() => createSessionAction(doc.id))}
        onReorder={(orderedIds) => {
          setDoc((d) => ({
            ...d,
            sessions: orderedIds
              .map((id) => d.sessions.find((s) => s.id === id))
              .filter((s): s is EditorSession => s !== undefined),
          }))
          void structural(() => reorderSessionsAction(doc.id, orderedIds))
        }}
        adding={structuralBusy}
      />
      <main className="px-4 pb-8 md:px-8">
        {activeSession ? (
          // SessionPanel arrives in the next task
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Session “{activeSession.label}” — content editor arrives in the next task.
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No sessions — add one with the + button above.
          </div>
        )}
      </main>
    </div>
  )
}
```

Note: `exercises`, `tags`, `warmups`, `clientsForPicker`, `setSessionField`, and `setRowField` are wired by Tasks 6–7; until then, prefix the unused ones with a single `void exercises` style suppression is NOT allowed — instead mark them as used by passing them to the placeholder: render nothing with them, but keep lint clean by destructuring only what Task 5 uses and accepting the rest via `..._rest`? No — keep ALL props declared (later tasks need the RSC to pass them already), and silence unused-var lint the sanctioned way: reference them in a single line inside the component:

```tsx
  // consumed by SessionPanel/rows in Tasks 6–7; referenced here to keep lint clean until then
  void exercises
  void tags
  void warmups
  void setSessionField
  void setRowField
```

Remove those `void` lines in Tasks 6–7 as each becomes genuinely used.

- [ ] **Step 6: Write the editor route + loading skeleton**

`src/app/(app)/clients/[id]/plans/[planId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { PlanEditor } from '@/components/plan-editor/plan-editor'
import { requireCoachId } from '@/lib/session'
import { listExercises } from '@/services/exercises'
import { getPlanForEditor } from '@/services/plans'
import { listTags } from '@/services/tags'
import { listWarmups } from '@/services/warmups'

export default async function PlanEditorPage({
  params,
}: {
  params: Promise<{ id: string; planId: string }>
}) {
  const coachId = await requireCoachId()
  const { planId } = await params
  if (!z.string().uuid().safeParse(planId).success) notFound()

  const [plan, exercises, tags, warmups] = await Promise.all([
    getPlanForEditor(coachId, planId),
    listExercises(coachId),
    listTags(coachId),
    listWarmups(coachId),
  ])
  if (!plan) notFound()

  return (
    <PlanEditor
      initial={plan}
      exercises={exercises}
      tags={tags}
      warmups={warmups}
    />
  )
}
```

`src/app/(app)/clients/[id]/plans/[planId]/loading.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function PlanEditorLoading() {
  return (
    <div className="space-y-4 p-4 md:p-8">
      <Skeleton className="h-8 w-2/3" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  )
}
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint && npm run build`. Then dev server + authenticated cookie: create a plan via `createPlanAction`? No — create through the UI path instead is not curl-able; instead curl an EXISTING plan's editor URL if one exists, else create one with a one-off tsx script calling the service `createPlan` directly (record the created plan id; it is real data on the real client — fine, the coach will see a "Plan – <Month>" draft; do NOT delete it). Confirm the editor page returns HTTP 200 and the HTML contains the plan title and the session chip label "Day 1". Also curl a bogus-uuid editor URL → 404, and a well-formed-but-unknown uuid → 404.

- [ ] **Step 8: Commit with trailer**

```bash
git add -A && git commit -m "feat: plan editor core with autosave, header, and session chips"
```

---

### Task 6: Session panel — label/weekday, focus note, cardio, warm-ups

**Files:**
- Create: `src/components/plan-editor/bottom-sheet.tsx`, `src/components/plan-editor/warmup-picker-sheet.tsx`, `src/components/plan-editor/warmup-section.tsx`, `src/components/plan-editor/session-panel.tsx`
- Modify: `src/components/plan-editor/plan-editor.tsx` (mount SessionPanel, wire session actions)

**Interfaces:**
- Consumes: Task 5 (`SessionFieldPatch`, editor root wiring), Task 3 actions (`duplicateSessionAction`, `deleteSessionAction`), `@/actions/warmups` (`createWarmupAction`), `WarmupLine` type from `@/db/schema`
- Produces: `<BottomSheet open onOpenChange title children />` (mobile bottom sheet on Dialog primitives — reused by Task 7), `<WarmupPickerSheet open onOpenChange presets onAdd(text) />` (save-to-presets handled internally via checkbox + `createWarmupAction`), `<WarmupSection lines onChange(lines) onOpenPicker />`, `<SessionPanel session warmups busy onField onDuplicate onDelete>{rowsSlot}</SessionPanel>` — `rowsSlot` is a `ReactNode` children slot Task 7 fills (Task 6 passes a placeholder from the root).

- [ ] **Step 1: Write `src/components/plan-editor/bottom-sheet.tsx`**

```tsx
'use client'

import type { ReactNode } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/** Mobile-first bottom sheet built on the Dialog primitives (Base UI — no extra dep). */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'fixed inset-x-0 bottom-0 top-auto max-h-[85dvh] w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-b-none rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
          'sm:inset-x-auto sm:left-1/2 sm:max-w-md sm:-translate-x-1/2',
          className,
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
```

(The generated `DialogContent` merges `className` through `cn`/tailwind-merge, so these overrides win over its centering defaults. Verify visually via the build + capstone; if the generated dialog positions differently, adjust only inside this file.)

- [ ] **Step 2: Write `src/components/plan-editor/warmup-picker-sheet.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createWarmupAction } from '@/actions/warmups'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WarmupPreset } from '@/services/warmups'
import { BottomSheet } from './bottom-sheet'

export function WarmupPickerSheet({
  open,
  onOpenChange,
  presets,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  presets: WarmupPreset[]
  onAdd: (text: string) => void
}) {
  const [freeText, setFreeText] = useState('')
  const [saveToPresets, setSaveToPresets] = useState(false)
  const [addedTexts, setAddedTexts] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function addPreset(text: string) {
    onAdd(text)
    setAddedTexts((prev) => [...prev, text])
  }

  async function addFreeText() {
    const text = freeText.trim()
    if (!text) return
    onAdd(text)
    setAddedTexts((prev) => [...prev, text])
    setFreeText('')
    if (saveToPresets) {
      setSaving(true)
      const result = await createWarmupAction({ text })
      setSaving(false)
      if (!result.ok) toast.error(result.error.message)
      else toast.success('Saved to your warm-ups')
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Add warm-up">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Write a warm-up line…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void addFreeText()
                }
              }}
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => void addFreeText()}
              disabled={saving || !freeText.trim()}
              aria-label="Add warm-up line"
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={saveToPresets}
              onChange={(e) => setSaveToPresets(e.target.checked)}
              className="size-3.5 accent-[var(--color-brand)]"
            />
            Also save to my warm-ups
          </label>
        </div>
        {presets.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your warm-ups
            </p>
            {presets.map((p) => {
              const added = addedTexts.includes(p.text)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addPreset(p.text)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border bg-card p-3 text-left text-sm hover:bg-accent/40"
                >
                  <span className="min-w-0 flex-1">{p.text}</span>
                  {added ? (
                    <Check className="size-4 shrink-0 text-brand" />
                  ) : (
                    <Plus className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              )
            })}
          </div>
        )}
        <Button className="w-full" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </div>
    </BottomSheet>
  )
}
```

- [ ] **Step 3: Write `src/components/plan-editor/warmup-section.tsx`**

```tsx
'use client'

import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Flame, GripVertical, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WarmupLine } from '@/db/schema'
import { cn } from '@/lib/utils'

function WarmupLineItem({
  line,
  index,
  onToggleHighlight,
  onRemove,
}: {
  line: WarmupLine
  index: number
  onToggleHighlight: () => void
  onRemove: () => void
}) {
  const id = `warmup-${index}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-1 rounded-xl border bg-card p-2',
        line.highlighted && 'border-brand/40 bg-brand/5',
        isDragging && 'z-10 opacity-80',
      )}
    >
      <button
        type="button"
        aria-label="Reorder warm-up line"
        className="cursor-grab touch-none p-1 text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <p className="min-w-0 flex-1 text-sm">{line.text}</p>
      <Button
        size="icon"
        variant="ghost"
        onClick={onToggleHighlight}
        aria-label={line.highlighted ? 'Remove highlight' : 'Highlight line'}
      >
        <Flame className={cn('size-4', line.highlighted ? 'text-brand' : 'text-muted-foreground')} />
      </Button>
      <Button size="icon" variant="ghost" onClick={onRemove} aria-label="Remove warm-up line">
        <X className="size-4 text-muted-foreground" />
      </Button>
    </div>
  )
}

export function WarmupSection({
  lines,
  onChange,
  onOpenPicker,
}: {
  lines: WarmupLine[]
  onChange: (lines: WarmupLine[]) => void
  onOpenPicker: () => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = Number(String(active.id).replace('warmup-', ''))
    const to = Number(String(over.id).replace('warmup-', ''))
    onChange(arrayMove(lines, from, to))
  }

  return (
    <section className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Warm-up</p>
      {lines.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={lines.map((_, i) => `warmup-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1.5">
              {lines.map((line, index) => (
                <WarmupLineItem
                  key={`warmup-${index}`}
                  line={line}
                  index={index}
                  onToggleHighlight={() =>
                    onChange(
                      lines.map((l, i) => (i === index ? { ...l, highlighted: !l.highlighted } : l)),
                    )
                  }
                  onRemove={() => onChange(lines.filter((_, i) => i !== index))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <Button variant="outline" size="sm" onClick={onOpenPicker}>
        <Plus className="size-4" /> Add warm-up
      </Button>
    </section>
  )
}
```

- [ ] **Step 4: Write `src/components/plan-editor/session-panel.tsx`**

```tsx
'use client'

import { useState, type ReactNode } from 'react'
import { Copy, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { SessionFieldPatch } from './plan-editor'
import type { EditorSession } from '@/services/plans'
import type { WarmupPreset } from '@/services/warmups'
import { WarmupPickerSheet } from './warmup-picker-sheet'
import { WarmupSection } from './warmup-section'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const NO_WEEKDAY = 'none'

export function SessionPanel({
  session,
  warmups,
  busy,
  onField,
  onDuplicate,
  onDelete,
  children,
}: {
  session: EditorSession
  warmups: WarmupPreset[]
  busy: boolean
  onField: (fields: SessionFieldPatch) => void
  onDuplicate: () => void
  onDelete: () => void
  children: ReactNode
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Input
          value={session.label}
          onChange={(e) => onField({ label: e.target.value })}
          aria-label="Session label"
          className="flex-1 font-semibold"
        />
        <Select
          value={session.weekday ?? NO_WEEKDAY}
          onValueChange={(v) => onField({ weekday: v === NO_WEEKDAY ? null : v })}
        >
          <SelectTrigger className="w-36" aria-label="Weekday">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_WEEKDAY}>No weekday</SelectItem>
            {WEEKDAYS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {session.focusNote === null ? (
        <Button variant="ghost" size="sm" onClick={() => onField({ focusNote: '' })}>
          <Plus className="size-4" /> Add focus note
        </Button>
      ) : (
        <div className="flex items-start gap-1 rounded-xl border-l-4 border-brand bg-muted p-3">
          <Textarea
            value={session.focusNote}
            onChange={(e) => onField({ focusNote: e.target.value })}
            placeholder="Session focus…"
            rows={2}
            className="min-h-0 flex-1 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onField({ focusNote: null })}
            aria-label="Remove focus note"
          >
            <X className="size-4 text-muted-foreground" />
          </Button>
        </div>
      )}

      <WarmupSection
        lines={session.warmupLines}
        onChange={(lines) => onField({ warmupLines: lines })}
        onOpenPicker={() => setPickerOpen(true)}
      />

      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workout</p>
        {children}
      </section>

      {session.cardioTime === null && session.cardioHrm === null ? (
        <Button variant="ghost" size="sm" onClick={() => onField({ cardioTime: '', cardioHrm: '' })}>
          <Plus className="size-4" /> Add cardio
        </Button>
      ) : (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cardio</p>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onField({ cardioTime: null, cardioHrm: null })}
              aria-label="Remove cardio"
            >
              <X className="size-4 text-muted-foreground" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={session.cardioTime ?? ''}
              onChange={(e) => onField({ cardioTime: e.target.value })}
              placeholder="Time — e.g. 20 min + 5 cool down"
            />
            <Input
              value={session.cardioHrm ?? ''}
              onChange={(e) => onField({ cardioHrm: e.target.value })}
              placeholder="Heart rate — e.g. 140 BPM incline 8"
            />
          </div>
        </section>
      )}

      <div className="flex gap-2 border-t pt-4">
        <Button variant="outline" size="sm" onClick={onDuplicate} disabled={busy}>
          <Copy className="size-4" /> Duplicate day
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={() => setDeleteOpen(true)}
          disabled={busy}
        >
          <Trash2 className="size-4" /> Delete day
        </Button>
      </div>

      <WarmupPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        presets={warmups}
        onAdd={(text) => onField({ warmupLines: [...session.warmupLines, { text, highlighted: false }] })}
      />
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {session.label}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the day and all its exercises from the plan.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleteOpen(false)
                onDelete()
              }}
            >
              Delete day
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

CAUTION — stale-closure risk the reviewer must see handled: `onAdd` inside `WarmupPickerSheet` calls `onField({ warmupLines: [...session.warmupLines, …] })` with the `session` prop captured at render time. Because every `onField` immediately updates the parent document state and this component re-renders with the fresh `session`, consecutive adds work; do not memoize `onAdd` or the sheet in a way that freezes the `session` closure.

- [ ] **Step 5: Wire into `src/components/plan-editor/plan-editor.tsx`**

Add imports:

```tsx
import {
  deleteSessionAction, duplicateSessionAction,
} from '@/actions/plan-editor'
import { SessionPanel } from './session-panel'
```

Remove the `void warmups` and `void setSessionField` suppression lines. Replace the active-session placeholder `<div>` with:

```tsx
          <SessionPanel
            session={activeSession}
            warmups={warmups}
            busy={structuralBusy}
            onField={(fields) => setSessionField(activeSession.id, fields)}
            onDuplicate={() => void structural(() => duplicateSessionAction(doc.id, activeSession.id))}
            onDelete={() => void structural(() => deleteSessionAction(doc.id, activeSession.id))}
          >
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Exercise rows arrive in the next task.
            </div>
          </SessionPanel>
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run lint && npm run build`; then dev server + authenticated cookie: curl the editor page of the Task 5 plan and confirm HTTP 200 with the session label input value and "Add warm-up" present in the HTML. Interactive flows (picker, dnd, toggles) are covered by the controller capstone.

- [ ] **Step 7: Commit with trailer**

```bash
git add -A && git commit -m "feat: session panel with warm-ups, focus note, and cardio"
```

---

### Task 7: Exercise rows + picker sheet

**Files:**
- Create: `src/components/plan-editor/exercise-picker-sheet.tsx`, `src/components/plan-editor/exercise-row-card.tsx`, `src/components/plan-editor/exercise-rows.tsx`
- Modify: `src/components/library/exercise-form-dialog.tsx` (add optional `initialName` prop), `src/components/plan-editor/plan-editor.tsx` (wire rows)

**Interfaces:**
- Consumes: Tasks 3, 5, 6; `@/components/library/exercise-form-dialog` (`ExerciseFormDialog`), `@/components/library/tag-filter` (`TagFilter`), `TagOption`, `ExerciseWithTags`
- Produces: `<ExercisePickerSheet open onOpenChange exercises tags onPick(exerciseId) />` (handles inline creation itself), `<ExerciseRowCard row onField onSwap onDuplicate onDelete />`, `<ExerciseRows session exercises tags busy onRowField onAdd(exerciseId) onSwap(rowId, exerciseId) onDuplicate(rowId) onDelete(rowId) onReorder(orderedIds) />`.

- [ ] **Step 1: Add `initialName` to `src/components/library/exercise-form-dialog.tsx`**

Add to the props type: `initialName?: string`. In the reset-on-open effect, change the name default from `exercise?.name ?? ''` to `exercise?.name ?? initialName ?? ''` (and add `initialName` to the effect's dependency array). No other changes.

- [ ] **Step 2: Write `src/components/plan-editor/exercise-picker-sheet.tsx`**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { Dumbbell, Plus, Search } from 'lucide-react'
import { ExerciseFormDialog } from '@/components/library/exercise-form-dialog'
import { TagFilter } from '@/components/library/tag-filter'
import type { TagOption } from '@/components/library/tag-multi-select'
import { Input } from '@/components/ui/input'
import type { ExerciseWithTags } from '@/services/exercises'
import { BottomSheet } from './bottom-sheet'

export function ExercisePickerSheet({
  open,
  onOpenChange,
  exercises,
  tags,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercises: ExerciseWithTags[]
  tags: TagOption[]
  onPick: (exerciseId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [tagId, setTagId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return exercises.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false
      if (tagId && !e.tags.some((t) => t.id === tagId)) return false
      return true
    })
  }, [exercises, search, tagId])

  const exactMatch = exercises.some((e) => e.name.toLowerCase() === search.trim().toLowerCase())

  function pick(id: string) {
    onPick(id)
    setSearch('')
    setTagId(null)
    onOpenChange(false)
  }

  return (
    <>
      <BottomSheet open={open} onOpenChange={onOpenChange} title="Add move">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search moves…"
              className="pl-9"
              inputMode="search"
            />
          </div>
          <TagFilter tags={tags} selected={tagId} onSelect={setTagId} />
          {search.trim() !== '' && !exactMatch && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl border border-dashed border-brand/50 p-3 text-left text-sm font-medium text-brand hover:bg-brand/5"
            >
              <Plus className="size-4" /> Create “{search.trim()}” as a new move
            </button>
          )}
          <div className="space-y-1.5">
            {filtered.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => pick(e.id)}
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-2.5 text-left hover:bg-accent/40"
              >
                {e.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.imageUrl} alt={e.name} className="size-10 rounded-lg border object-cover" />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                    <Dumbbell className="size-4 text-muted-foreground" />
                  </div>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.name}</span>
              </button>
            ))}
            {filtered.length === 0 && search.trim() === '' && (
              <p className="p-4 text-center text-sm text-muted-foreground">No moves in your library yet.</p>
            )}
          </div>
        </div>
      </BottomSheet>
      <ExerciseFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        tagOptions={tags}
        initialName={search.trim()}
        onCreated={(id) => pick(id)}
      />
    </>
  )
}
```

- [ ] **Step 3: Write `src/components/plan-editor/exercise-row-card.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, Dumbbell, GripVertical, MoreVertical, StickyNote, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { EditorRow } from '@/services/plans'

const FIELDS = [
  { key: 'sets', label: 'Sets' },
  { key: 'reps', label: 'Reps' },
  { key: 'speed', label: 'Speed' },
  { key: 'oneRm', label: '1RM' },
  { key: 'rest', label: 'Rest' },
] as const

export function ExerciseRowCard({
  row,
  onField,
  onSwap,
  onDuplicate,
  onDelete,
}: {
  row: EditorRow
  onField: (fields: Record<string, string | null>) => void
  onSwap: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [noteOpen, setNoteOpen] = useState(row.note !== null && row.note !== '')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('space-y-2 rounded-2xl border bg-card p-3', isDragging && 'z-10 opacity-80')}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Reorder move"
          className="cursor-grab touch-none p-1 text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          onClick={onSwap}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left hover:bg-accent/40"
        >
          {row.exercise.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.exercise.imageUrl}
              alt={row.exercise.name}
              className="size-9 rounded-lg border object-cover"
            />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <Dumbbell className="size-4 text-muted-foreground" />
            </div>
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.exercise.name}</span>
        </button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setNoteOpen((v) => !v)}
          aria-label="Toggle note"
        >
          <StickyNote
            className={cn('size-4', row.note ? 'text-brand' : 'text-muted-foreground')}
          />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Row actions">
                <MoreVertical className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onDuplicate}>
              <Copy className="size-4" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 className="size-4" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {FIELDS.map(({ key, label }) => (
          <div key={key} className="space-y-0.5">
            <p className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <Input
              value={row[key] ?? ''}
              onChange={(e) => onField({ [key]: e.target.value })}
              className="h-8 px-1 text-center text-xs"
              aria-label={`${row.exercise.name} ${label}`}
            />
          </div>
        ))}
      </div>
      {noteOpen && (
        <Textarea
          value={row.note ?? ''}
          onChange={(e) => onField({ note: e.target.value })}
          placeholder="Note for this move…"
          rows={2}
          className="text-sm"
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write `src/components/plan-editor/exercise-rows.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { TagOption } from '@/components/library/tag-multi-select'
import { Button } from '@/components/ui/button'
import type { ExerciseWithTags } from '@/services/exercises'
import type { EditorSession } from '@/services/plans'
import { ExercisePickerSheet } from './exercise-picker-sheet'
import { ExerciseRowCard } from './exercise-row-card'

type PickerMode = { type: 'add' } | { type: 'swap'; rowId: string } | null

export function ExerciseRows({
  session,
  exercises,
  tags,
  busy,
  onRowField,
  onAdd,
  onSwap,
  onDuplicate,
  onDelete,
  onReorder,
}: {
  session: EditorSession
  exercises: ExerciseWithTags[]
  tags: TagOption[]
  busy: boolean
  onRowField: (rowId: string, fields: Record<string, string | null>) => void
  onAdd: (exerciseId: string) => void
  onSwap: (rowId: string, exerciseId: string) => void
  onDuplicate: (rowId: string) => void
  onDelete: (rowId: string) => void
  onReorder: (orderedIds: string[]) => void
}) {
  const [picker, setPicker] = useState<PickerMode>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = session.rows.map((r) => r.id)
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  return (
    <div className="space-y-2">
      {session.rows.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={session.rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {session.rows.map((row) => (
                <ExerciseRowCard
                  key={row.id}
                  row={row}
                  onField={(fields) => onRowField(row.id, fields)}
                  onSwap={() => setPicker({ type: 'swap', rowId: row.id })}
                  onDuplicate={() => onDuplicate(row.id)}
                  onDelete={() => onDelete(row.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <Button variant="outline" className="w-full" onClick={() => setPicker({ type: 'add' })} disabled={busy}>
        <Plus className="size-4" /> Add move
      </Button>
      <ExercisePickerSheet
        open={picker !== null}
        onOpenChange={(open) => {
          if (!open) setPicker(null)
        }}
        exercises={exercises}
        tags={tags}
        onPick={(exerciseId) => {
          if (picker?.type === 'swap') onSwap(picker.rowId, exerciseId)
          else onAdd(exerciseId)
          setPicker(null)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 5: Wire into `src/components/plan-editor/plan-editor.tsx`**

Add imports:

```tsx
import {
  createRowAction, deleteRowAction, duplicateRowAction, reorderRowsAction, swapRowExerciseAction,
} from '@/actions/plan-editor'
import { ExerciseRows } from './exercise-rows'
```

Remove the remaining `void exercises` / `void tags` / `void setRowField` suppression lines. Replace the `SessionPanel` children placeholder `<div>` with:

```tsx
            <ExerciseRows
              session={activeSession}
              exercises={exercises}
              tags={tags}
              busy={structuralBusy}
              onRowField={(rowId, fields) => setRowField(activeSession.id, rowId, fields)}
              onAdd={(exerciseId) =>
                void structural(() => createRowAction(doc.id, activeSession.id, exerciseId))
              }
              onSwap={(rowId, exerciseId) =>
                void structural(() => swapRowExerciseAction(doc.id, rowId, exerciseId))
              }
              onDuplicate={(rowId) => void structural(() => duplicateRowAction(doc.id, rowId))}
              onDelete={(rowId) => void structural(() => deleteRowAction(doc.id, rowId))}
              onReorder={(orderedIds) => {
                setDoc((d) => ({
                  ...d,
                  sessions: d.sessions.map((s) =>
                    s.id === activeSession.id
                      ? {
                          ...s,
                          rows: orderedIds
                            .map((id) => s.rows.find((r) => r.id === id))
                            .filter((r): r is EditorRow => r !== undefined),
                        }
                      : s,
                  ),
                }))
                void structural(() => reorderRowsAction(doc.id, activeSession.id, orderedIds))
              }}
            />
```

Also add `EditorRow` to the type-only import from `@/services/plans` in this file.

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run lint && npm run build`; then dev server + authenticated cookie: curl the editor page and confirm HTTP 200 with "Add move" present. Full interactive verification (picker, inline create, dnd, autosave round-trip) is the controller capstone that follows this task.

- [ ] **Step 7: Commit with trailer**

```bash
git add -A && git commit -m "feat: exercise rows with picker, inline create, and reordering"
```

---

## Post-plan: controller capstone (not a task)

After Task 7's review clears, the controller drives the full browser walkthrough on the real seeded data (spec §6) — create plan from Ali's profile, rename, add/duplicate/reorder sessions and rows from the seeded library (incl. inline move creation), fill fields, verify autosave survives a reload, focus note + cardio + warm-ups with highlight, duplicate plan, status change, share generate/copy/revoke, delete the duplicate — with screenshots to the user. The module is done only after that passes.

## Follow-ups deliberately deferred to the share/PDF module

- Public `/p/[slug]` page (generated links 404 until then).
- Export PDF button (hidden this module).
- Editor "Export PDF" and share-view polish.
