# Planit Editor Local-First Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every editor interaction instant by turning the editor into a fully local document with one explicit Save (autosave removed per user directive), and stop the app-wide post-action refetch cascade by re-issuing the session cookie daily instead of per-request.

**Architecture:** The editor mutates local React state only; `savePlanDocument` persists the whole document in one transaction via delete-and-reinsert of sessions/rows (no external references exist to their ids). Ten structural server actions and the autosave hook are deleted. Client-generated `crypto.randomUUID()` ids serve React/dnd only — the server never receives them.

**Tech Stack:** unchanged (no new dependencies).

**Spec:** `docs/superpowers/specs/2026-09-21-planit-editor-local-first-design.md` (supersedes the autosave design; parent specs still bind)

## Global Constraints

- **No automated tests** (explicit user decision). Verify via `npm run typecheck`, `npm run lint`, `npm run build` (+ authenticated curl where SSR-visible); interactivity is the controller's browser capstone.
- Strict TypeScript, no `any`. Design tokens only; mobile-first. Zero `asChild`; Base UI `render` prop; menu items use `onClick`.
- **Zero server calls during editing** — only Save, plan-lifecycle actions (create/duplicate/delete/share/status-from-profile), and inline move creation may hit the server.
- Every service stays coach-scoped; soft-deleted plans excluded.
- No dead code: every removed feature's exports, imports, and files are deleted in the same task that obsoletes them (lint enforces no unused symbols).
- Every commit message ends with this exact trailer line, on its own line in the commit BODY after a blank line — even if your own guidelines suggest a different model name: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- `.env.local` exists with live credentials — never print it. The live DB holds real data (one client, one plan): do not delete or mutate it during verification beyond what a step explicitly says.

## File Structure

```
src/lib/validation.ts                       planDocumentSchema replaces planPatchSchema
src/services/plans.ts                       savePlanDocument replaces patch + 9 structural fns
src/actions/plan-editor.ts                  savePlanDocumentAction replaces 10 actions
src/components/plan-editor/plan-editor.tsx  REWRITE: local document, dirty/save
src/components/plan-editor/editor-header.tsx REWRITE: Save/dirty/leave-guard
src/components/plan-editor/session-chips.tsx  minor: drop `adding` prop
src/components/plan-editor/session-panel.tsx  minor: drop `busy` prop
src/components/plan-editor/exercise-rows.tsx  minor: PickedExercise callbacks, drop `busy`
src/components/plan-editor/exercise-picker-sheet.tsx  onPick(exercise), refresh after create
src/components/library/exercise-form-dialog.tsx  onCreated passes {id,name,imageUrl}
src/hooks/use-autosave.ts                   DELETED
src/lib/auth.ts + src/middleware.ts         daily cookie re-issue
```

---

### Task 1: savePlanDocument service + schema (and remove the patch/structural layer)

**Files:**
- Modify: `src/lib/validation.ts`, `src/services/plans.ts`

**Interfaces:**
- Consumes: existing `getOwnedPlan`, schema tables
- Produces: `@/lib/validation`: `planDocumentSchema`, `type PlanDocument` (planPatchSchema/PlanPatch REMOVED; planMetaSchema kept — the profile card menu still uses it). `@/services/plans`: `savePlanDocument(coachId, planId, doc: PlanDocument): Promise<{ clientId: string } | undefined>`; REMOVED: `applyPlanPatch`, `createSession`, `duplicateSession`, `deleteSession`, `reorderSessions`, `createRow`, `swapRowExercise`, `duplicateRow`, `deleteRow`, `reorderRows`, `getOwnedSession`, `getOwnedRow`, `touchPlan`, `DbOrTx`. Everything else in the file (types, `listPlansForClient`, `getPlanForEditor`, `createPlan`, `updatePlanMeta`, `softDeletePlan`, `duplicatePlan`, share fns, `getOwnedPlan`) stays.
- NOTE: Task 2 removes the actions that consume the deleted services — typecheck will FAIL between Task 1 and Task 2. That is expected staged construction: in THIS task verify with `npx tsc --noEmit 2>&1 | grep -v "src/actions/plan-editor"` showing no OTHER errors, and skip lint/build; Task 2 restores green.

- [ ] **Step 1: Replace `planPatchSchema` in `src/lib/validation.ts`**

Delete the `planPatchSchema` export and its `PlanPatch` type (keep the `patchText` helper — rename it `docText` — and keep `planMetaSchema`). Add:

```ts
export const planDocumentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  status: z.enum(['draft', 'active', 'completed']),
  sessions: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        weekday: z.string().max(20).nullable(),
        focusNote: docText(500),
        warmupLines: z
          .array(z.object({ text: z.string().min(1).max(300), highlighted: z.boolean() }))
          .max(50),
        cardioTime: docText(120),
        cardioHrm: docText(120),
        rows: z
          .array(
            z.object({
              exerciseId: z.string().uuid(),
              sets: docText(40),
              reps: docText(40),
              speed: docText(120),
              oneRm: docText(120),
              rest: docText(60),
              note: docText(500),
            }),
          )
          .max(100),
      }),
    )
    .max(30),
})
export type PlanDocument = z.infer<typeof planDocumentSchema>
```

- [ ] **Step 2: Add `savePlanDocument` to `src/services/plans.ts`**

```ts
import type { PlanDocument } from '@/lib/validation'
```

(replacing the `PlanPatch` type import)

```ts
export async function savePlanDocument(
  coachId: string,
  planId: string,
  doc: PlanDocument,
): Promise<{ clientId: string } | undefined> {
  const plan = await getOwnedPlan(coachId, planId)
  if (!plan) return undefined

  const exerciseIds = [...new Set(doc.sessions.flatMap((s) => s.rows.map((r) => r.exerciseId)))]
  if (exerciseIds.length > 0) {
    const owned = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(eq(exercises.coachId, coachId), inArray(exercises.id, exerciseIds)))
    if (owned.length !== exerciseIds.length) return undefined
  }

  await db.transaction(async (tx) => {
    await tx
      .update(plans)
      .set({ title: doc.title, status: doc.status })
      .where(eq(plans.id, planId))
    await tx.delete(planSessions).where(eq(planSessions.planId, planId))
    for (const [index, s] of doc.sessions.entries()) {
      const [session] = await tx
        .insert(planSessions)
        .values({
          planId,
          position: index + 1,
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
          s.rows.map((r, rowIndex) => ({
            sessionId: session.id,
            position: rowIndex + 1,
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
    }
  })
  return { clientId: plan.clientId }
}
```

(The plan-table update triggers the schema's `$onUpdate` on `updated_at`, so recency stays correct with `touchPlan` gone.)

- [ ] **Step 3: Delete the obsolete service layer**

Remove from `src/services/plans.ts`: `applyPlanPatch`, `createSession`, `duplicateSession`, `deleteSession`, `reorderSessions`, `createRow`, `swapRowExercise`, `duplicateRow`, `deleteRow`, `reorderRows`, `getOwnedSession`, `getOwnedRow`, `touchPlan`, the `DbOrTx` type. Then prune now-unused imports (`sql` becomes unused; check each of `asc`/`desc`/`inArray` — `asc` and `inArray` remain used by `getPlanForEditor`/`savePlanDocument`, `desc` by `listPlansForClient`).

- [ ] **Step 4: Verify (staged)**

Run: `npx tsc --noEmit 2>&1 | grep -v "src/actions/plan-editor" | head -20`
Expected: no errors outside `src/actions/plan-editor.ts` (that file is Task 2's job; its errors here are the expected staging).

- [ ] **Step 5: Commit with trailer**

```bash
git add -A && git commit -m "feat: savePlanDocument replaces patch and structural services"
```

---

### Task 2: Actions — one save endpoint, ten removals

**Files:**
- Modify: `src/actions/plan-editor.ts`

**Interfaces:**
- Consumes: Task 1 (`savePlanDocument`, `planDocumentSchema`)
- Produces: `savePlanDocumentAction(planId: string, input: unknown): Promise<ActionResult<null>>`. REMOVED actions: `applyPlanPatchAction`, `createSessionAction`, `duplicateSessionAction`, `deleteSessionAction`, `reorderSessionsAction`, `createRowAction`, `swapRowExerciseAction`, `duplicateRowAction`, `deleteRowAction`, `reorderRowsAction`. KEPT: `createPlanAction`, `duplicatePlanAction`, `deletePlanAction`, `updatePlanMetaAction` (+ its `freshPayload` helper), `generateShareSlugAction`, `revokeShareSlugAction`, the `uuid`/`isUuid` helpers (`uuidList` becomes unused — delete it).
- NOTE: components still import removed actions until Task 3 — same staged-verification approach as Task 1, this time excluding `src/components/plan-editor` and `src/hooks` from the typecheck grep.

- [ ] **Step 1: Add the save action**

```ts
export async function savePlanDocumentAction(
  planId: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    if (!isUuid(planId)) return err('validation', 'Invalid id.')
    const parsed = planDocumentSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const saved = await savePlanDocument(coachId, planId, parsed.data)
    if (!saved) return err('not_found', 'Plan not found.')
    revalidatePath(`/clients/${saved.clientId}`)
    return ok(null)
  })
}
```

- [ ] **Step 2: Remove the ten obsolete actions and prune imports**

Delete the ten actions listed above, the `uuidList` helper, and update the import block from `@/services/plans` (drop the removed services) and from `@/lib/validation` (swap `planPatchSchema` → `planDocumentSchema`).

- [ ] **Step 3: Verify (staged)**

Run: `npx tsc --noEmit 2>&1 | grep -vE "src/components/plan-editor|src/hooks" | head -20`
Expected: no errors outside the editor components / hooks (Task 3's job).

- [ ] **Step 4: Commit with trailer**

```bash
git add -A && git commit -m "feat: single save-document action replaces structural actions"
```

---

### Task 3: Editor client rework — local document, Save, leave guard

**Files:**
- Rewrite: `src/components/plan-editor/plan-editor.tsx`, `src/components/plan-editor/editor-header.tsx`
- Modify: `src/components/plan-editor/session-chips.tsx` (drop `adding` prop + its `disabled`), `src/components/plan-editor/session-panel.tsx` (drop `busy` prop + the two `disabled={busy}` usages), `src/components/plan-editor/exercise-rows.tsx`, `src/components/plan-editor/exercise-picker-sheet.tsx`, `src/components/library/exercise-form-dialog.tsx`
- Delete: `src/hooks/use-autosave.ts`

**Interfaces:**
- Consumes: Task 2 (`savePlanDocumentAction`), existing lifecycle/share actions, `PlanDocument` type
- Produces: `type PickedExercise = { id: string; name: string; imageUrl: string | null }` (exported from plan-editor.tsx); `ExerciseFormDialog.onCreated?: (exercise: PickedExercise) => void` (changed signature — its only consumer is the picker); `ExercisePickerSheet.onPick: (exercise: PickedExercise) => void`; `ExerciseRows` callbacks `onAdd(exercise)`, `onSwap(rowId, exercise)` (others unchanged), `busy` prop removed.

- [ ] **Step 1: Rewrite `src/components/plan-editor/plan-editor.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { savePlanDocumentAction } from '@/actions/plan-editor'
import type { TagOption } from '@/components/library/tag-multi-select'
import type { PlanDocument } from '@/lib/validation'
import type { ExerciseWithTags } from '@/services/exercises'
import type { EditorPlan, EditorRow, EditorSession } from '@/services/plans'
import type { WarmupPreset } from '@/services/warmups'
import { EditorHeader } from './editor-header'
import { ExerciseRows } from './exercise-rows'
import { SessionChips } from './session-chips'
import { SessionPanel } from './session-panel'

export type SessionFieldPatch = Partial<
  Pick<EditorSession, 'label' | 'weekday' | 'focusNote' | 'warmupLines' | 'cardioTime' | 'cardioHrm'>
>

export type PickedExercise = { id: string; name: string; imageUrl: string | null }

function toDocument(plan: EditorPlan): PlanDocument {
  return {
    title: plan.title.trim(),
    status: plan.status,
    sessions: plan.sessions.map((s) => ({
      label: s.label.trim(),
      weekday: s.weekday,
      focusNote: s.focusNote,
      warmupLines: s.warmupLines,
      cardioTime: s.cardioTime,
      cardioHrm: s.cardioHrm,
      rows: s.rows.map((r) => ({
        exerciseId: r.exercise.id,
        sets: r.sets,
        reps: r.reps,
        speed: r.speed,
        oneRm: r.oneRm,
        rest: r.rest,
        note: r.note,
      })),
    })),
  }
}

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
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const editCount = useRef(0)
  const docRef = useRef(doc)
  docRef.current = doc

  /** Every local mutation goes through here — instant, no server calls. */
  const mutate = useCallback((updater: (d: EditorPlan) => EditorPlan) => {
    editCount.current += 1
    setDirty(true)
    setDoc(updater)
  }, [])

  const save = useCallback(async (): Promise<boolean> => {
    if (saving) return false
    if (!dirty) return true
    const current = docRef.current
    if (current.title.trim() === '') {
      toast.error('Give the plan a title before saving.')
      return false
    }
    if (current.sessions.some((s) => s.label.trim() === '')) {
      toast.error('Every day needs a label before saving.')
      return false
    }
    setSaving(true)
    const startCount = editCount.current
    try {
      const result = await savePlanDocumentAction(current.id, toDocument(current))
      if (!result.ok) {
        toast.error(result.error.message)
        return false
      }
      if (editCount.current === startCount) setDirty(false)
      return true
    } catch {
      toast.error('Could not save — check your connection and try again.')
      return false
    } finally {
      setSaving(false)
    }
  }, [dirty, saving])

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // ----- local document mutations -----

  const setSessionField = useCallback(
    (sessionId: string, fields: SessionFieldPatch) => {
      mutate((d) => ({
        ...d,
        sessions: d.sessions.map((s) => (s.id === sessionId ? { ...s, ...fields } : s)),
      }))
    },
    [mutate],
  )

  const setRowField = useCallback(
    (sessionId: string, rowId: string, fields: Record<string, string | null>) => {
      mutate((d) => ({
        ...d,
        sessions: d.sessions.map((s) =>
          s.id === sessionId
            ? { ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, ...fields } : r)) }
            : s,
        ),
      }))
    },
    [mutate],
  )

  const addSession = useCallback(() => {
    const id = crypto.randomUUID()
    mutate((d) => ({
      ...d,
      sessions: [
        ...d.sessions,
        {
          id,
          position: d.sessions.length + 1,
          label: `Day ${d.sessions.length + 1}`,
          weekday: null,
          focusNote: null,
          warmupLines: [],
          cardioTime: null,
          cardioHrm: null,
          rows: [],
        },
      ],
    }))
    setActiveSessionId(id)
  }, [mutate])

  const duplicateSession = useCallback(
    (sessionId: string) => {
      const id = crypto.randomUUID()
      mutate((d) => {
        const source = d.sessions.find((s) => s.id === sessionId)
        if (!source) return d
        const copy: EditorSession = {
          ...source,
          id,
          position: d.sessions.length + 1,
          label: `${source.label} (copy)`,
          warmupLines: source.warmupLines.map((l) => ({ ...l })),
          rows: source.rows.map((r) => ({
            ...r,
            id: crypto.randomUUID(),
            exercise: { ...r.exercise },
          })),
        }
        return { ...d, sessions: [...d.sessions, copy] }
      })
      setActiveSessionId(id)
    },
    [mutate],
  )

  const deleteSession = useCallback(
    (sessionId: string) => {
      const remaining = docRef.current.sessions.filter((s) => s.id !== sessionId)
      mutate((d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== sessionId) }))
      setActiveSessionId((current) =>
        current === sessionId ? (remaining[0]?.id ?? null) : current,
      )
    },
    [mutate],
  )

  const reorderSessions = useCallback(
    (orderedIds: string[]) => {
      mutate((d) => ({
        ...d,
        sessions: orderedIds
          .map((id) => d.sessions.find((s) => s.id === id))
          .filter((s): s is EditorSession => s !== undefined),
      }))
    },
    [mutate],
  )

  const addRow = useCallback(
    (sessionId: string, exercise: PickedExercise) => {
      mutate((d) => ({
        ...d,
        sessions: d.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                rows: [
                  ...s.rows,
                  {
                    id: crypto.randomUUID(),
                    position: s.rows.length + 1,
                    sets: null,
                    reps: null,
                    speed: null,
                    oneRm: null,
                    rest: null,
                    note: null,
                    exercise,
                  },
                ],
              }
            : s,
        ),
      }))
    },
    [mutate],
  )

  const swapRow = useCallback(
    (sessionId: string, rowId: string, exercise: PickedExercise) => {
      mutate((d) => ({
        ...d,
        sessions: d.sessions.map((s) =>
          s.id === sessionId
            ? { ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, exercise } : r)) }
            : s,
        ),
      }))
    },
    [mutate],
  )

  const duplicateRow = useCallback(
    (sessionId: string, rowId: string) => {
      mutate((d) => ({
        ...d,
        sessions: d.sessions.map((s) => {
          if (s.id !== sessionId) return s
          const index = s.rows.findIndex((r) => r.id === rowId)
          const source = index === -1 ? undefined : s.rows[index]
          if (!source) return s
          const copy: EditorRow = {
            ...source,
            id: crypto.randomUUID(),
            exercise: { ...source.exercise },
          }
          const rows = [...s.rows]
          rows.splice(index + 1, 0, copy)
          return { ...s, rows }
        }),
      }))
    },
    [mutate],
  )

  const deleteRow = useCallback(
    (sessionId: string, rowId: string) => {
      mutate((d) => ({
        ...d,
        sessions: d.sessions.map((s) =>
          s.id === sessionId ? { ...s, rows: s.rows.filter((r) => r.id !== rowId) } : s,
        ),
      }))
    },
    [mutate],
  )

  const reorderRows = useCallback(
    (sessionId: string, orderedIds: string[]) => {
      mutate((d) => ({
        ...d,
        sessions: d.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                rows: orderedIds
                  .map((id) => s.rows.find((r) => r.id === id))
                  .filter((r): r is EditorRow => r !== undefined),
              }
            : s,
        ),
      }))
    },
    [mutate],
  )

  const activeSession = doc.sessions.find((s) => s.id === activeSessionId) ?? null

  return (
    <div className="min-h-dvh">
      <EditorHeader
        plan={doc}
        dirty={dirty}
        saving={saving}
        onTitleChange={(title) => mutate((d) => ({ ...d, title }))}
        onStatusChange={(status) => mutate((d) => ({ ...d, status }))}
        onSave={() => void save()}
        onEnsureSaved={save}
        onShareChanged={(slug) => setDoc((d) => ({ ...d, shareSlug: slug }))}
      />
      <SessionChips
        sessions={doc.sessions}
        activeSessionId={activeSessionId}
        onSelect={setActiveSessionId}
        onAdd={addSession}
        onReorder={reorderSessions}
      />
      <main className="px-4 pb-8 md:px-8">
        {activeSession ? (
          <SessionPanel
            session={activeSession}
            warmups={warmups}
            onField={(fields) => setSessionField(activeSession.id, fields)}
            onDuplicate={() => duplicateSession(activeSession.id)}
            onDelete={() => deleteSession(activeSession.id)}
          >
            <ExerciseRows
              session={activeSession}
              exercises={exercises}
              tags={tags}
              onRowField={(rowId, fields) => setRowField(activeSession.id, rowId, fields)}
              onAdd={(exercise) => addRow(activeSession.id, exercise)}
              onSwap={(rowId, exercise) => swapRow(activeSession.id, rowId, exercise)}
              onDuplicate={(rowId) => duplicateRow(activeSession.id, rowId)}
              onDelete={(rowId) => deleteRow(activeSession.id, rowId)}
              onReorder={(orderedIds) => reorderRows(activeSession.id, orderedIds)}
            />
          </SessionPanel>
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

(Note: the share-slug change intentionally uses `setDoc`, not `mutate` — the slug is already server-persisted and must not mark the document dirty.)

- [ ] **Step 2: Rewrite `src/components/plan-editor/editor-header.tsx`**

```tsx
'use client'

import { useState } from 'react'
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
import { cn } from '@/lib/utils'
import type { EditorPlan } from '@/services/plans'

export function EditorHeader({
  plan,
  dirty,
  saving,
  onTitleChange,
  onStatusChange,
  onSave,
  onEnsureSaved,
  onShareChanged,
}: {
  plan: EditorPlan
  dirty: boolean
  saving: boolean
  onTitleChange: (title: string) => void
  onStatusChange: (status: EditorPlan['status']) => void
  onSave: () => void
  onEnsureSaved: () => Promise<boolean>
  onShareChanged: (slug: string | null) => void
}) {
  const router = useRouter()
  const [shareOpen, setShareOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const backHref = `/clients/${plan.clientId}`

  async function duplicate() {
    if (busy) return
    setBusy(true)
    try {
      if (dirty) {
        const saved = await onEnsureSaved()
        if (!saved) return
      }
      const result = await duplicatePlanAction(plan.id)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Duplicated — you are now editing the copy')
      router.push(`/clients/${plan.clientId}/plans/${result.data.id}`)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (busy) return
    setBusy(true)
    try {
      const result = await deletePlanAction(plan.id)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Plan deleted')
      router.push(backHref)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function saveAndLeave() {
    const saved = await onEnsureSaved()
    if (saved) router.push(backHref)
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="flex items-center gap-1 px-2 py-2 md:px-6">
        <button
          type="button"
          onClick={() => (dirty ? setLeaveOpen(true) : router.push(backHref))}
          className="flex items-center gap-1 p-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> {plan.client.name}
        </button>
        <span
          className={cn('ml-auto text-xs', dirty ? 'text-brand' : 'text-muted-foreground')}
          aria-live="polite"
        >
          {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved ✓'}
        </span>
        <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save'}
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
            <DropdownMenuItem onClick={() => void duplicate()}>
              <Copy className="size-4" /> Duplicate plan
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShareOpen(true)}>
              <Link2 className="size-4" /> Share
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" /> Delete plan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3 md:px-8">
        <input
          value={plan.title}
          onChange={(e) => onTitleChange(e.target.value)}
          maxLength={200}
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

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You have edits that haven't been saved yet.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => router.push(backHref)}>Discard</Button>
            <Button onClick={() => void saveAndLeave()} disabled={saving}>
              Save &amp; leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
```

- [ ] **Step 3: Prop tweaks in the four child components**

a. `session-chips.tsx`: remove the `adding` prop from the props type and destructure, and remove `disabled={adding}` from the add button.
b. `session-panel.tsx`: remove the `busy` prop and both `disabled={busy}` attributes (Duplicate day / Delete day buttons).
c. `exercise-rows.tsx`: change the props type — `onAdd: (exercise: PickedExercise) => void`, `onSwap: (rowId: string, exercise: PickedExercise) => void`, remove `busy` (and its `disabled` on the Add move button). Import `type PickedExercise` from `./plan-editor`. In `onPick`, pass the exercise object through: `onPick={(exercise) => { if (picker?.type === 'swap') onSwap(picker.rowId, exercise); else onAdd(exercise); setPicker(null) }}`.
d. `exercise-picker-sheet.tsx`: change `onPick: (exercise: PickedExercise) => void` (import the type from `./plan-editor`); list picks call `pick({ id: e.id, name: e.name, imageUrl: e.imageUrl })`; add `const router = useRouter()` (import from `next/navigation`); the `ExerciseFormDialog`'s `onCreated` becomes `(exercise) => { router.refresh(); pick(exercise) }` — the refresh updates the RSC-provided library list without touching the editor's local document.
e. `src/components/library/exercise-form-dialog.tsx`: change `onCreated?: (id: string) => void` to `onCreated?: (exercise: { id: string; name: string; imageUrl: string | null }) => void`; at the create-success call site build it from the submitted values: `onCreated?.({ id: result.data.id, name: values.name, imageUrl: typeof values.imageUrl === 'string' && values.imageUrl !== '' ? values.imageUrl : null })`. (Its other mount in library-moves-tab passes no `onCreated` — unaffected.)

- [ ] **Step 4: Delete `src/hooks/use-autosave.ts`** (and confirm nothing imports it: `grep -rn "use-autosave" src/` returns nothing).

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint && npm run build` — all green now (staging complete; 2 pre-existing warnings OK — note the old third warning source, use-autosave, is gone). Then dev server + authenticated cookie: curl the test plan's editor page (plan cdc92ec4-5971-4d22-a2c6-86b7d84c8f0e, client 5e7ca94a-df57-419d-bec6-4c1b1236c240) → HTTP 200, HTML contains the plan title input, "Save", and "Add move". Retry once or twice on transient pooler timeouts. Interactive flows (instant mutations, save round-trip, leave guard) are the controller capstone.

- [ ] **Step 6: Commit with trailer**

```bash
git add -A && git commit -m "feat: local-first editor with explicit save and leave guard"
```

---

### Task 4: Daily session-cookie re-issue

**Files:**
- Modify: `src/lib/auth.ts`, `src/middleware.ts`

**Interfaces:**
- Produces: `@/lib/auth`: `verifySessionWithAge(token: string): Promise<{ coachId: string; issuedAt: number } | null>` (existing `verifySessionToken` unchanged — `lib/session.ts` keeps using it).

- [ ] **Step 1: Add to `src/lib/auth.ts`**

```ts
export async function verifySessionWithAge(
  token: string,
): Promise<{ coachId: string; issuedAt: number } | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (!payload.sub || typeof payload.iat !== 'number') return null
    return { coachId: payload.sub, issuedAt: payload.iat }
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Update `src/middleware.ts`**

Replace the `verifySessionToken` usage with `verifySessionWithAge` (adjust the import), derive `const coachId = session?.coachId ?? null`, and replace the unconditional re-issue block with:

```ts
  const response = NextResponse.next()
  if (session) {
    // sliding 1-year expiry, refreshed at most once a day — avoids the
    // set-cookie → router-refetch cascade after every server action
    const ageSeconds = Math.floor(Date.now() / 1000) - session.issuedAt
    if (ageSeconds > 60 * 60 * 24) {
      response.cookies.set(SESSION_COOKIE, await signSession(session.coachId), sessionCookieOptions)
    }
  }
  return response
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint && npm run build`; then dev server: `curl -sI localhost:3000/ -b "planit_session=<fresh token>"` → response has NO `set-cookie` header (token younger than a day), and an unauthenticated `curl -sI localhost:3000/` still 307s to /login.

- [ ] **Step 4: Commit with trailer**

```bash
git add -A && git commit -m "perf: re-issue session cookie daily instead of per request"
```

---

## Post-plan: controller capstone (not a task)

Browser walkthrough on the real test plan: rapid-fire local interactions (add/duplicate/reorder/delete sessions and rows, warm-ups, fields) confirming zero-latency and no disabled-button windows; Save → hard reload → full persistence; leave-guard (Discard and Save & leave paths); duplicate-plan-includes-unsaved-edits; offline save failure → dirty preserved + honest toast → recovery. Screenshots to the user.
