# Planit — Plan Editor Module Design

**Date:** 2026-09-20
**Status:** Approved design (user-confirmed), pre-implementation
**Parent spec:** `2026-09-20-planit-design.md` (its Global Constraints and data model bind this module)

The plan editor is the core screen: a coach builds and maintains a client's workout
plan on a phone. This module also upgrades the client profile's plan list from
read-only to fully actionable.

## 1. Scope

- Plan lifecycle: create (instant draft, auto-title "Plan – <Month Year>", opens
  editor immediately), inline title edit, status select (draft/active/completed),
  soft delete with confirm, duplicate (in place → "<title> (copy)"; or to another
  client via client picker → same title), always duplicating as draft.
- Editor: ordered sessions as horizontally swipeable/selectable chips (one session
  on screen), per-session label + optional weekday (Mon–Sun dropdown), optional
  focus note and cardio block behind "+ Add …" buttons, warm-up lines with preset
  picker sheet (multi-add + free text + save-to-preset toggle + per-line highlight
  toggle), exercise rows as compact cards with the five inline fields
  (sets/reps/speed/1RM/rest) in a two-line grid and the note behind an expander.
- Exercise picker: full-height bottom sheet — search, tag chips, thumbnails,
  pinned "Create '<typed>'" row reusing the library's `ExerciseFormDialog`,
  auto-select on create. Tapping a row's exercise name/thumbnail swaps via the
  same picker.
- Reordering: drag-and-drop via `@dnd-kit/core` + `@dnd-kit/sortable` (touch
  sensors) for session chips (horizontal) and rows (vertical).
- Share: generate (nanoid 12) / copy / revoke link, available for ANY status, from
  the editor header menu and the plan card menu. The public `/p/[slug]` page ships
  in the NEXT module — links 404 until then (accepted).
- Autosave: 10s debounce, batched single-request patches, flush on tab-hide /
  in-app navigation / explicit Save / before every structural op. Save indicator
  "Saving… / Saved ✓ / Unsaved changes" beside the Save button.

**Out of scope:** public share page, print/PDF (Export button HIDDEN this module),
versioning, supersets, templates.

## 2. Data & services (no schema changes)

All in `src/services/plans.ts`, coach-scoped, every mutation calling a shared
`touchPlan(tx, planId)` that bumps `plans.updated_at`.

Editor payload types (exported):

```
EditorRow     = row fields + { exercise: { id, name, imageUrl } }
EditorSession = session fields (incl. warmupLines) + rows: EditorRow[]
EditorPlan    = plan fields + { client: { id, name } } + sessions: EditorSession[]
```

Functions: `createPlan` (bootstraps session "Day 1"), `getPlanForEditor`,
`updatePlanMeta` (title/status), `softDeletePlan`, `duplicatePlan(planId,
targetClientId?)` (single-transaction deep copy, status draft, no shareSlug),
`generateShareSlug` / `revokeShareSlug`, `createSession` (position max+1, label
"Day N"), `updateSession`, `duplicateSession` ("<label> (copy)", position max+1),
`deleteSession`, `reorderSessions(orderedIds)` (validated set-equality),
`createRow(sessionId, exerciseId)`, `swapRowExercise`, `duplicateRow`,
`deleteRow`, `reorderRows`, and `applyPlanPatch(planId, patch)`.

`applyPlanPatch` is the autosave endpoint: a zod-validated `PlanPatch`
(`{ plan?: {title}, sessions?: Record<id, Partial<fields>>, rows?: Record<id,
Partial<fields>> }`, free-text fields with sane max lengths) applied in one
transaction after verifying every patched session/row id belongs to the coach's
plan. Last-write-wins.

**Structural-return rule:** every structural service/action (create/duplicate/
delete/reorder/swap of sessions and rows, status/title via meta, duplicate plan)
returns the fresh `EditorPlan` payload; the editor replaces its local document
with it — no client-side guesswork about positions or ids.

## 3. Autosave engine (client)

`useAutosave(planId)` hook owning a dirty buffer:

- `queueField(kind: 'plan'|'session'|'row', id, partial)` merges into the buffer,
  sets status `dirty`, restarts the 10s timer. Callers update local document
  state themselves (single `useState` document in the editor root, immutable
  updates).
- `flush()` no-ops when clean; otherwise status `saving` → one
  `applyPlanPatchAction` → `saved`, or on failure back to `dirty` + toast (buffer
  preserved).
- `runStructural(fn)` = `await flush()` then `fn()` (whose result payload replaces
  the document).
- Effects: flush on `visibilitychange→hidden` and on unmount; `beforeunload`
  warns when dirty. Accepted caveat: a cold process kill inside the 10s window
  can lose ≤10s of field edits; app-switch/lock flushes via visibilitychange.

## 4. Routes & profile upgrade

- `/clients/[id]/plans/[planId]` — RSC fetches `getPlanForEditor` + the coach's
  exercises-with-tags, tags, and warm-up presets (pickers open instantly), hydrates
  the client editor; `notFound()` on missing/foreign plan; loading skeleton.
- Client profile: plan cards link to the editor; per-card ⋯ menu = open, duplicate
  in place, duplicate to another client (client-picker dialog), status change,
  share, delete (confirm). "New plan" FAB = create + navigate to editor.

## 5. Components (`src/components/plan-editor/`, plus plan-list upgrades under `clients/`)

`plan-editor.tsx` (root: document state + autosave), `editor-header.tsx`,
`session-chips.tsx` (dnd horizontal), `session-panel.tsx`, `warmup-section.tsx` +
`warmup-picker-sheet.tsx`, `exercise-row-card.tsx`, `exercise-picker-sheet.tsx`,
`share-sheet.tsx` (shared with plan card menu), `client-picker-dialog.tsx`,
`plan-card-menu.tsx`, `new-plan-button.tsx`. Bottom sheets via shadcn sheet (Base
UI generation; `render` prop rule; if unavailable, a bottom-pinned Dialog variant).
New dependency: `@dnd-kit/core` + `@dnd-kit/sortable` (+ `@dnd-kit/utilities`).

## 6. Verification

Per task: typecheck/lint/build (+ authenticated curl where SSR-visible). Module
capstone: controller-driven browser walkthrough of the entire flow on the real
seeded data (create → edit everything → autosave-survives-reload → reorder →
duplicate day/plan → status → share generate/copy/revoke → delete duplicate),
with screenshots to the user.
