# Planit — Editor v2: Local-First Rework

**Date:** 2026-09-21
**Status:** Approved (user directive after production latency feedback)
**Supersedes:** the autosave/structural-round-trip design in
`2026-09-20-planit-plan-editor-design.md` §2–3 (everything else in that spec
stands).

## Motivation (user feedback, verbatim requirements)

Production latency made the editor unusable: per-interaction server round
trips (3–5s per structural op, "sometimes forever"), plus the post-action RSC
refetch cascade. User requirements: **remove the autosaver**, and the editor
must have **zero latency for user actions**. Everything else may stay as-is
for now (Supabase region move deferred).

## Design

### 1. The editor is a fully local document

Every interaction — title/status, session add/duplicate/delete/reorder,
label/weekday/focus/cardio, warm-up lines, row add/swap/duplicate/delete/
reorder, all field edits — mutates local React state instantly. **Zero server
calls during editing.** New sessions/rows get client-side
`crypto.randomUUID()` ids (used only for React keys and dnd — the server
never receives them).

### 2. One explicit Save

A prominent Save button (enabled when dirty) sends the whole document once:

- `planDocumentSchema` (zod): `{ title, status, sessions: [{ label, weekday,
  focusNote, warmupLines, cardioTime, cardioHrm, rows: [{ exerciseId,
  sets, reps, speed, oneRm, rest, note }] }] }` — same field caps as before;
  caps: ≤30 sessions, ≤100 rows/session, ≤50 warm-up lines.
- `savePlanDocument(coachId, planId, doc)`: verify plan ownership → verify
  every `exerciseId` belongs to the coach (one set query) → one transaction:
  update plan title/status, **delete all sessions (cascade rows), re-insert
  from the document in array order** with fresh server ids. Positions come
  from array order. Returns `{ clientId }` for profile revalidation.
  Delete-and-reinsert is correct here: session/row ids have no external
  references (the share view walks by plan id), documents are small, and it
  makes the save endpoint trivially idempotent and conflict-free
  (last-write-wins, single-coach workspaces).
- Client-side pre-save validation with friendly toasts: non-empty title and
  session labels (empty ones block save with a specific message).
- On success: clear dirty **only if no edits happened during the request**
  (edit counter); the client keeps its local ids — it never needs the
  server's (the next save reconciles wholesale again).
- On failure/transport error: toast, stay dirty, nothing lost.
- `saving` disables only the Save button — editing stays fully interactive.

### 3. Unsaved-changes protection

- `beforeunload` warning while dirty.
- The header back-link becomes a guard: when dirty, a dialog offers
  **Save & leave / Discard / Cancel**.
- Duplicate plan (header menu) ensures a save first when dirty (a copy must
  include current edits); if that save fails, duplication aborts. Delete
  plan just confirms (edits are moot).

### 4. Action surface shrinks

Removed (server): `applyPlanPatch` + all session/row structural services and
their 10 actions, `planPatchSchema`, the `useAutosave` hook. Remaining editor-
related actions: `savePlanDocumentAction` (new), `createPlanAction`,
`duplicatePlanAction`, `deletePlanAction`, `updatePlanMetaAction` (profile
card status cycle), share generate/revoke, and the library's inline
create-move (rare, explicit, acceptable round trip).

### 5. Inline move creation feeds the local document

`ExerciseFormDialog.onCreated` now passes `{ id, name, imageUrl }` (the
dialog knows its submitted values) so the picker can hand the editor a
complete exercise for the new local row; after inline creation the picker
triggers `router.refresh()` so the RSC-provided library list catches up
(document state is decoupled from props, so the refresh cannot clobber
edits).

### 6. Session cookie: daily re-issue (app-wide latency fix)

Middleware re-issues the sliding session cookie only when the token is older
than 24h (new `verifySessionWithAge` in lib/auth), keeping the 1-year sliding
behavior while eliminating the set-cookie → router-refetch cascade after
every server action.

## Verification

Per task: typecheck/lint/build (+ curl where SSR-visible). Capstone
(controller browser): rapid-fire interactions with zero perceived latency,
save → hard reload persistence, leave-guard flows, offline save failure
(dirty preserved + honest toast), duplicate-plan-includes-unsaved-edits.
