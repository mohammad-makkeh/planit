# Planit — UI Revisit, Slice 1: Clients List, Form Sheets, Library Chips

**Date:** 2026-09-21
**Status:** Approved (user directive + in-chat design approval)
**Parent spec:** `2026-09-20-planit-design.md` (Global Constraints bind)

## Motivation (user feedback)

Screens shipped with visual defects: the clients-page search bar is edge-to-edge
(clipped corners, no gutter), the bottom navbar on the clients page is cut off on
mobile until you scroll, the New-client FAB anchors wrong on device, form modals
lack padding and feel non-native on mobile, and the library filter chips are
"very small". The user mandated an app-like **bottom sheet** design language for
form modals — **on desktop too** — plus **blobatar** avatars, and a standing rule:
every UI change is visually verified at mobile and desktop widths before done.

## Root cause note

Three symptoms share one bug: `src/app/(app)/page.tsx` wraps the search bar in
`-mx-4 px-4` inside an unpadded `<main>`, pushing it 16px past both viewport
edges. That horizontal overflow widens the mobile layout viewport, which is what
cuts off the fixed bottom nav and distorts fixed-button anchoring on device.

## Design

### 1. `BottomSheet` component (`src/components/ui/bottom-sheet.tsx`)

Built on **vaul** (1.1.2): slides from the bottom with real drag physics.
- Drag marker: centered `h-1.5 w-10 rounded-full` bar at the top; dragging down
  dismisses.
- `rounded-t-2xl bg-popover`, max height `92dvh`, inner scroll area with `px-6`,
  bottom padding `calc(env(safe-area-inset-bottom) + 1.5rem)`.
- Desktop: same bottom sheet, constrained `md:max-w-lg` centered (`mx-auto`).
- Exports mirror the dialog family: `BottomSheet` (Root, controlled
  `open`/`onOpenChange`), `BottomSheetContent`, `BottomSheetHeader`,
  `BottomSheetTitle`.
- vaul is self-contained (its own Radix-based primitives); it does not mix APIs
  with our Base UI components.

### 2. Form modals become sheets (scope: forms only, per user)

- `client-form-dialog.tsx` → `client-form-sheet.tsx` (`ClientFormSheet`): same
  form, logic, wasOpen reset guard, and actions — only the shell changes.
  Consumers: `new-client-button.tsx`, `client-actions-menu.tsx`.
- `exercise-form-dialog.tsx` → `exercise-form-sheet.tsx` (`ExerciseFormSheet`):
  same, keeping `initialName`/`onCreated`. Consumers: `library-moves-tab.tsx`,
  `plan-editor/exercise-picker-sheet.tsx` (nested above the picker — the sheet
  portal mounts later in the DOM, so it stacks above at equal z-index).
- Confirm/destructive dialogs (delete client/move/plan, leave guard) stay
  dialogs in this slice.

### 3. Clients page layout fix

Drop the negative-margin hack; the sticky search wrapper keeps
`px-4 md:px-8` so the input aligns exactly with the card gutter. Acceptance:
`document.scrollingElement.scrollWidth === window.innerWidth` at 390px.

### 4. Blobatar avatars (everywhere a client shows, per user)

`npm i blobatar @blobatar/react` (installed: 2.7.0). `<Blobatar name={...}
size={...} />` — deterministic from the client's name. Replaces the initials
`AvatarFallback` in: `client-card.tsx` (44), `clients/[id]/page.tsx` header
(56), `plans/client-picker-dialog.tsx` (36). Static mode (no motion CSS).

### 5. Library tag chips

Real chip buttons instead of `Badge`-in-button: `h-9 px-4 rounded-full text-sm
font-medium`, brand-filled when active, outline otherwise, `gap-2`, horizontal
scroll kept, `shrink-0` per chip.

## Verification

Per task: typecheck/lint/build. Capstone (controller browser): screenshots at
390×844 and 1280×800 of clients list, client profile, library, and both sheets
open on both widths; no horizontal overflow on the clients page; sheet
drag-to-dismiss works; editor inline-create still layers correctly over the
exercise picker. Visual defects are failing gates.
