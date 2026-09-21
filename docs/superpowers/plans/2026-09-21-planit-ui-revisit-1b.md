# UI Revisit Slice 1b Implementation Plan (continuation, same branch)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the approved bottom-sheet design language to every remaining modal, and land the audit's polish fixes — one concern per task, one commit per task (user directive: no batching).

**Architecture:** The vaul `BottomSheet` from slice 1 (`src/components/ui/bottom-sheet.tsx`) becomes the shell for the editor's exercise picker, warm-up picker, the share sheet, and the client picker; the plan-editor's local Dialog-based `bottom-sheet.tsx` then dies. Small targeted edits fix menus, login wordmark, logout styling, and a11y/dead-code leftovers.

**Tech Stack:** unchanged (vaul + blobatar already installed on this branch).

**Spec:** docs/superpowers/specs/2026-09-21-planit-ui-revisit-1-design.md (design language section) + the audit findings recorded in this plan.

## Audit findings driving this plan

1. Exercise picker (editor): old Dialog shell; content blows out to 1015px wide inside a 390px viewport (grid `min-width:auto` + the chips row), causing internal horizontal scroll and edge-flush title/search. No drag marker.
2. Warm-up picker: old Dialog shell (padding fine) — needs the vaul shell for consistency.
3. Share sheet: centered floating card — inconsistent with the sheet language.
4. Client picker ("Copy plan to…"): centered dialog — same.
5. Plan-card dropdown: 128px min-width wraps "Copy to another client" onto 3 lines; "Mark as …" item is the only one without an icon (misaligned).
6. Login wordmark is plain black; sidebar renders `Plan<span class=text-brand>it</span>`.
7. Settings "Log out" reads like a neutral action; should read destructive.
8. Dead code: `src/components/ui/avatar.tsx` (zero imports), `initials()` in `src/lib/format.ts` (zero call sites). Tag chips lack a focus-visible ring.

## Global Constraints

- Strict TypeScript; NO automated tests (explicit decision). Gates per task: `npm run typecheck && npm run lint && npm run build` — zero errors (the 2 pre-existing `react-hooks/incompatible-library` warnings are acceptable).
- Base UI shadcn: `render` prop not `asChild`; `onClick` not `onSelect` on menu items. vaul stays self-contained.
- No server code/actions/services/validation changes.
- Every converted sheet keeps its form/interaction logic byte-identical — only the shell changes.
- Commit message trailer, on its own line in the body after a blank line, exactly: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Never push. Never dispatch subagents. One commit per task.

---

### Task 1: Exercise picker → ui BottomSheet

**Files:**
- Modify: `src/components/plan-editor/exercise-picker-sheet.tsx`

**Interfaces:**
- Consumes: `BottomSheet`, `BottomSheetContent`, `BottomSheetHeader`, `BottomSheetTitle` from `@/components/ui/bottom-sheet`.
- Produces: `ExercisePickerSheet` with unchanged props (`open`, `onOpenChange`, `exercises`, `tags`, `onPick`).

- [ ] **Step 1: Swap the shell**

Replace the import `import { BottomSheet } from './bottom-sheet'` with:
```tsx
import {
  BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle,
} from '@/components/ui/bottom-sheet'
```
Replace the shell JSX (everything inside stays byte-identical — search box, `TagFilter`, create-row, list, empty state):
```tsx
<BottomSheet open={open} onOpenChange={onOpenChange} title="Add move">
  <div className="space-y-3">
    …
  </div>
</BottomSheet>
```
becomes
```tsx
<BottomSheet open={open} onOpenChange={onOpenChange}>
  <BottomSheetContent className="h-[85dvh]">
    <BottomSheetHeader>
      <BottomSheetTitle>Add move</BottomSheetTitle>
    </BottomSheetHeader>
    <div className="space-y-3">
      …
    </div>
  </BottomSheetContent>
</BottomSheet>
```
`h-[85dvh]` keeps the picker a stable height while the user types (the results list shrinking must not bounce the sheet). The `ExerciseFormSheet` in the trailing fragment stays exactly where it is — vaul-over-vaul nesting is supported (both are Radix modals, unlike the Base-UI-over-vaul case fixed earlier).

- [ ] **Step 2: Gates** — `npm run typecheck && npm run lint && npm run build`, zero errors.

- [ ] **Step 3: Commit** — `feat: exercise picker on the vaul bottom sheet` + trailer.

---

### Task 2: Warm-up picker → ui BottomSheet

**Files:**
- Modify: `src/components/plan-editor/warmup-picker-sheet.tsx`

- [ ] **Step 1: Swap the shell** — same recipe as Task 1: import swap (drop `./bottom-sheet`), then
```tsx
<BottomSheet open={open} onOpenChange={onOpenChange} title="Add warm-up">
  <div className="space-y-4">…</div>
</BottomSheet>
```
becomes
```tsx
<BottomSheet open={open} onOpenChange={onOpenChange}>
  <BottomSheetContent>
    <BottomSheetHeader>
      <BottomSheetTitle>Add warm-up</BottomSheetTitle>
    </BottomSheetHeader>
    <div className="space-y-4">…</div>
  </BottomSheetContent>
</BottomSheet>
```
No fixed height here (content-sized is right for this one). All state/handlers/preset rows byte-identical.

- [ ] **Step 2: Gates.** — as Task 1.

- [ ] **Step 3: Commit** — `feat: warm-up picker on the vaul bottom sheet` + trailer.

---

### Task 3: Share sheet → BottomSheet

**Files:**
- Modify: `src/components/plans/share-sheet.tsx`

- [ ] **Step 1: Swap the shell.** Replace the `Dialog, DialogContent, DialogHeader, DialogTitle` import from `@/components/ui/dialog` with the four bottom-sheet exports (as in Task 1), then:
```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Share plan</DialogTitle>
    </DialogHeader>
    {url ? (…) : (…)}
  </DialogContent>
</Dialog>
```
becomes
```tsx
<BottomSheet open={open} onOpenChange={onOpenChange}>
  <BottomSheetContent>
    <BottomSheetHeader>
      <BottomSheetTitle>Share plan</BottomSheetTitle>
    </BottomSheetHeader>
    {url ? (…) : (…)}
  </BottomSheetContent>
</BottomSheet>
```
Both content branches (link + copy + revoke / create-link) stay byte-identical, including the `origin` effect and its eslint-disable comment.

- [ ] **Step 2: Gates.**
- [ ] **Step 3: Commit** — `feat: share plan as bottom sheet` + trailer.

---

### Task 4: Client picker → BottomSheet (rename to client-picker-sheet)

**Files:**
- Create: `src/components/plans/client-picker-sheet.tsx` (from `client-picker-dialog.tsx`, then DELETE the old file)
- Modify: `src/components/plans/plan-card-menu.tsx` (the only consumer — import + JSX tag only)

- [ ] **Step 1: Create the sheet.** Copy `client-picker-dialog.tsx` verbatim to `client-picker-sheet.tsx`, rename the export `ClientPickerDialog` → `ClientPickerSheet` (the `PickerClient` type export stays), swap the dialog import for the four bottom-sheet exports, and re-shell:
```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-sm">
    <DialogHeader>
      <DialogTitle>Copy plan to…</DialogTitle>
    </DialogHeader>
    …
  </DialogContent>
</Dialog>
```
becomes
```tsx
<BottomSheet open={open} onOpenChange={onOpenChange}>
  <BottomSheetContent>
    <BottomSheetHeader>
      <BottomSheetTitle>Copy plan to…</BottomSheetTitle>
    </BottomSheetHeader>
    …
  </BottomSheetContent>
</BottomSheet>
```
The options list / empty state / Blobatar rows stay byte-identical. Delete `client-picker-dialog.tsx`.

- [ ] **Step 2: Update the consumer.** In `plan-card-menu.tsx`: `import { ClientPickerSheet, type PickerClient } from './client-picker-sheet'` and rename the JSX tag (same props).

- [ ] **Step 3: Gates**, plus `grep -rn "ClientPickerDialog\|client-picker-dialog" src` → zero matches.
- [ ] **Step 4: Commit** — `feat: client picker as bottom sheet` + trailer.

---

### Task 5: Dropdown menu polish (plan card + client actions)

**Files:**
- Modify: `src/components/plans/plan-card-menu.tsx`
- Modify: `src/components/clients/client-actions-menu.tsx`

- [ ] **Step 1: Plan card menu.** In `plan-card-menu.tsx`:
  1. `<DropdownMenuContent align="end">` → `<DropdownMenuContent align="end" className="min-w-56">` (stops "Copy to another client" wrapping onto three lines at 390px).
  2. Add `RefreshCw` to the lucide-react import list and give the status item its icon:
     ```tsx
     <DropdownMenuItem onClick={() => void cycleStatus()}>
       <RefreshCw className="size-4" /> Mark as {NEXT_STATUS[plan.status]}
     </DropdownMenuItem>
     ```

- [ ] **Step 2: Client actions menu.** In `client-actions-menu.tsx`, add the same `className="min-w-56"` to its `DropdownMenuContent`. If its items ("Edit details", "Delete client") lack lucide icons, add `Pencil` and `Trash2` (size-4, same pattern as plan-card-menu); if they already have icons, leave them.

- [ ] **Step 3: Gates.**
- [ ] **Step 4: Commit** — `fix: dropdown menus wide enough for one-line items, icon alignment` + trailer.

---

### Task 6: Login wordmark + destructive Log out

**Files:**
- Modify: `src/app/(public)/login/page.tsx:16`
- Modify: `src/app/(app)/settings/page.tsx` (the Log out button)

- [ ] **Step 1: Login.** Match the sidebar wordmark:
```tsx
<h1 className="text-3xl font-bold tracking-tight">Plan<span className="text-brand">it</span></h1>
```

- [ ] **Step 2: Log out.**
```tsx
<Button variant="outline" className="w-full" type="submit">
```
becomes
```tsx
<Button variant="outline" className="w-full text-destructive" type="submit">
```

- [ ] **Step 3: Gates.**
- [ ] **Step 4: Commit** — `fix: brand login wordmark, destructive log out` + trailer.

---

### Task 7: Cleanup and chip focus rings

**Files:**
- Delete: `src/components/plan-editor/bottom-sheet.tsx` (unused after Tasks 1–2 — verify with `grep -rn "from './bottom-sheet'" src/components/plan-editor` → zero matches first)
- Delete: `src/components/ui/avatar.tsx` (zero imports — verify `grep -rn "ui/avatar" src` → nothing)
- Modify: `src/lib/format.ts` (remove the `initials` function only — verify `grep -rn "initials" src` shows only its definition first)
- Modify: `src/components/library/tag-filter.tsx` (focus ring)

- [ ] **Step 1: Verify with the three greps above, then delete/edit.** If any grep finds a live consumer, STOP and report instead of deleting.

- [ ] **Step 2: Focus ring.** In `tag-filter.tsx`, extend `chipClass`'s base string with the repo's button focus convention:
```
'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30'
```
(active/inactive branches unchanged).

- [ ] **Step 3: Gates.**
- [ ] **Step 4: Commit** — `chore: drop dead avatar/initials/local sheet, chip focus rings` + trailer.

---

## Post-plan (controller)

Browser capstone at 390×844 (mobile emulation) and 1280×800: exercise picker (content width == panel width — no internal horizontal blow-out; drag marker; 16px+ padding; stable height while searching; nested create-move still opens on top and prefills), warm-up picker (marker + padding, preset add works locally), share sheet and client picker bottom-anchored with markers, plan-card menu items on one line with aligned icons, login wordmark brand-red "it", Log out red, tag chips show focus ring on keyboard focus, and a regression pass of the editor (add move via picker locally, no save). Screenshots to the user, then final whole-branch review of the full `ui-revisit-1` branch delta (base 35a5777).
