# UI Revisit Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bottom-sheet form modals (vaul), blobatar avatars, clients-page overflow/padding fix, finger-sized library chips.

**Architecture:** One new `BottomSheet` ui component wraps vaul; the two form
dialogs re-shell onto it unchanged; three small visual fixes land as direct
edits with complete code below.

**Tech Stack:** Next.js App Router, Tailwind, shadcn (Base UI), vaul 1.1.2, blobatar 2.7.0 + @blobatar/react (already installed on this branch).

**Spec:** docs/superpowers/specs/2026-09-21-planit-ui-revisit-1-design.md

## Global Constraints

- Strict TypeScript; NO automated tests in this project (explicit decision). Gates: `npm run typecheck`, `npm run lint`, `npm run build` — all must pass per task.
- shadcn here wraps **Base UI, not Radix**: `render` prop instead of `asChild`; menu items use `onClick`, never `onSelect`. (vaul is self-contained and unaffected.)
- Do not touch server code, actions, services, or validation in this slice.
- Mobile-first: no horizontal overflow, tap targets ≥ 36px, safe-area insets respected.
- Commit messages end with exactly this trailer on its own line in the body, after a blank line: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Never push. Never dispatch subagents.

---

### Task 1: BottomSheet component + convert both form dialogs

**Files:**
- Create: `src/components/ui/bottom-sheet.tsx`
- Create: `src/components/clients/client-form-sheet.tsx` (content of `client-form-dialog.tsx`, re-shelled; then DELETE `client-form-dialog.tsx`)
- Create: `src/components/library/exercise-form-sheet.tsx` (content of `exercise-form-dialog.tsx`, re-shelled; then DELETE `exercise-form-dialog.tsx`)
- Modify: `src/components/clients/new-client-button.tsx`, `src/components/clients/client-actions-menu.tsx`, `src/components/library/library-moves-tab.tsx`, `src/components/plan-editor/exercise-picker-sheet.tsx` (imports/JSX tags only)

**Interfaces:**
- Consumes: `vaul` (`Drawer` namespace), existing forms.
- Produces: `BottomSheet`, `BottomSheetContent`, `BottomSheetHeader`, `BottomSheetTitle` from `@/components/ui/bottom-sheet`; `ClientFormSheet` (same props as old `ClientFormDialog`); `ExerciseFormSheet` (same props as old `ExerciseFormDialog`, incl. `initialName`, `onCreated`).

- [ ] **Step 1: Create `src/components/ui/bottom-sheet.tsx`**

```tsx
'use client'

import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'
import { cn } from 'cn'

function BottomSheet({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="bottom-sheet" {...props} />
}

function BottomSheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <DrawerPrimitive.Content
        data-slot="bottom-sheet-content"
        aria-describedby={undefined}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-popover text-sm text-popover-foreground outline-none ring-1 ring-foreground/10 md:max-w-lg',
          className,
        )}
        {...props}
      >
        <div
          aria-hidden
          className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25"
        />
        <div className="overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4">
          {children}
        </div>
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  )
}

function BottomSheetHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="bottom-sheet-header"
      className={cn('flex flex-col gap-2 pb-4', className)}
      {...props}
    />
  )
}

function BottomSheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="bottom-sheet-title"
      className={cn('font-heading text-base leading-none font-medium', className)}
      {...props}
    />
  )
}

export { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle }
```

- [ ] **Step 2: Create `client-form-sheet.tsx`, delete `client-form-dialog.tsx`**

Copy `src/components/clients/client-form-dialog.tsx` verbatim into
`src/components/clients/client-form-sheet.tsx`, then apply ONLY these changes
(all form logic, the `wasOpen` reset guard, submit handler, and field JSX stay
byte-identical):

1. Rename the exported component `ClientFormDialog` → `ClientFormSheet` and the
   exported type `ClientFormClient` stays as is.
2. Replace the dialog import with:
   ```tsx
   import {
     BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle,
   } from '@/components/ui/bottom-sheet'
   ```
3. Replace the shell JSX:
   ```tsx
   <Dialog open={open} onOpenChange={onOpenChange}>
     <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
       <DialogHeader>
         <DialogTitle>{client ? 'Edit client' : 'New client'}</DialogTitle>
       </DialogHeader>
       …form…
     </DialogContent>
   </Dialog>
   ```
   becomes
   ```tsx
   <BottomSheet open={open} onOpenChange={onOpenChange}>
     <BottomSheetContent>
       <BottomSheetHeader>
         <BottomSheetTitle>{client ? 'Edit client' : 'New client'}</BottomSheetTitle>
       </BottomSheetHeader>
       …form…
     </BottomSheetContent>
   </BottomSheet>
   ```
4. Remove the `autoFocus` prop from the name `Input` (auto-focus fights the
   sheet's slide-in and pops the mobile keyboard over the drag animation).
5. Delete `src/components/clients/client-form-dialog.tsx`.

- [ ] **Step 3: Create `exercise-form-sheet.tsx`, delete `exercise-form-dialog.tsx`**

Same recipe for `src/components/library/exercise-form-dialog.tsx` →
`src/components/library/exercise-form-sheet.tsx`:

1. `ExerciseFormDialog` → `ExerciseFormSheet`. Props unchanged (`open`,
   `onOpenChange`, `exercise`, `tagOptions`, `initialName`, `onCreated`).
2. Same import swap and shell swap as Step 2, title stays
   `{exercise ? 'Edit move' : 'New move'}`.
3. Remove `autoFocus={!exercise}` from the name input.
4. The nested `ExerciseDeleteDialog` (rendered outside the sheet, in the
   fragment) stays a Dialog and stays exactly where it is.
5. Delete `src/components/library/exercise-form-dialog.tsx`.

- [ ] **Step 4: Update the four consumers**

- `src/components/clients/new-client-button.tsx`: `import { ClientFormSheet } from './client-form-sheet'`; render `<ClientFormSheet open={open} onOpenChange={setOpen} />`.
- `src/components/clients/client-actions-menu.tsx`: swap `ClientFormDialog` import/tag for `ClientFormSheet` (same props).
- `src/components/library/library-moves-tab.tsx`: swap `ExerciseFormDialog` import/tags for `ExerciseFormSheet` (same props, both the create and edit usages).
- `src/components/plan-editor/exercise-picker-sheet.tsx`: swap `ExerciseFormDialog` import/tag for `ExerciseFormSheet` (same props).

- [ ] **Step 5: Gates**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: zero errors (the two pre-existing `react-hooks/incompatible-library` warnings in exercise-form-sheet.tsx and settings/profile-form.tsx are acceptable).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: bottom-sheet form modals via vaul

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Clients page overflow fix, blobatar avatars, finger-sized chips

**Files:**
- Modify: `src/app/(app)/page.tsx:22` (one className)
- Modify: `src/components/clients/client-card.tsx`
- Modify: `src/app/(app)/clients/[id]/page.tsx:40-44`
- Modify: `src/components/plans/client-picker-dialog.tsx:42-46`
- Modify: `src/components/library/tag-filter.tsx` (rewrite)

**Interfaces:**
- Consumes: `Blobatar` from `@blobatar/react` (`<Blobatar name={string} size={number} />`).
- Produces: nothing new — visual changes only.

- [ ] **Step 1: Fix the clients-page sticky search wrapper**

In `src/app/(app)/page.tsx`, the sticky div currently reads:
```tsx
<div className="sticky top-14 z-20 -mx-4 bg-background/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
```
Replace with (negative margins removed, gutters kept):
```tsx
<div className="sticky top-14 z-20 bg-background/95 px-4 py-2 backdrop-blur md:px-8">
```

- [ ] **Step 2: Blobatar in `client-card.tsx`**

Replace the `Avatar` import with `import { Blobatar } from '@blobatar/react'`,
drop the `initials` import (keep `formatRelative`), and replace the avatar
block:
```tsx
<Avatar className="size-11">
  <AvatarFallback className="bg-brand/10 font-semibold text-brand">
    {initials(client.name)}
  </AvatarFallback>
</Avatar>
```
with:
```tsx
<div className="shrink-0">
  <Blobatar name={client.name} size={44} />
</div>
```

- [ ] **Step 3: Blobatar in the client profile header**

In `src/app/(app)/clients/[id]/page.tsx`, same swap: remove the
`Avatar`/`AvatarFallback` import, import `Blobatar` from `@blobatar/react`,
remove `initials` from the `@/lib/format` import if now unused in that file,
and replace:
```tsx
<Avatar className="size-14">
  <AvatarFallback className="bg-brand/10 text-lg font-semibold text-brand">
    {initials(client.name)}
  </AvatarFallback>
</Avatar>
```
with:
```tsx
<div className="shrink-0">
  <Blobatar name={client.name} size={56} />
</div>
```

- [ ] **Step 4: Blobatar in `client-picker-dialog.tsx`**

Same swap at the size-9 avatar:
```tsx
<div className="shrink-0">
  <Blobatar name={c.name} size={36} />
</div>
```
Remove the now-unused `Avatar`/`AvatarFallback` and `initials` imports from
this file.

- [ ] **Step 5: Rewrite `tag-filter.tsx` with real chip buttons**

Full new file content:
```tsx
'use client'

import { cn } from '@/lib/utils'
import type { TagOption } from './tag-multi-select'

function chipClass(active: boolean): string {
  return cn(
    'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors',
    active
      ? 'border-transparent bg-brand text-brand-foreground'
      : 'border-input bg-background text-foreground hover:bg-accent',
  )
}

export function TagFilter({
  tags,
  selected,
  onSelect,
}: {
  tags: TagOption[]
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
      <button type="button" className={chipClass(selected === null)} onClick={() => onSelect(null)}>
        All
      </button>
      {tags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          className={chipClass(selected === tag.id)}
          onClick={() => onSelect(tag.id === selected ? null : tag.id)}
        >
          {tag.name}
        </button>
      ))}
    </div>
  )
}
```
(The `Badge` import goes away entirely.)

- [ ] **Step 6: Gates**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: zero errors, same two pre-existing warnings only. Also verify no file
still imports `client-form-dialog` or `exercise-form-dialog`:
`grep -rn "form-dialog" src --include="*.tsx"` → only `exercise-delete-dialog`
and unrelated matches may remain.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix: clients page overflow, blobatar avatars, tappable tag chips

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Post-plan (controller)

Browser capstone at 390×844 AND 1280×800: clients list (search bar gutter =
card gutter, `scrollWidth === innerWidth`, blobatars render), client profile
(blobatar), library (chips ≥ 36px tall, tappable), New client sheet and New
move sheet open on both widths (drag marker visible, padding correct,
drag-to-dismiss works, desktop max-w-lg centered), editor inline-create sheet
still layers above the exercise picker. Screenshots to the user.
