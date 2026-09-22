# Planit — Share View & Print/PDF Module

**Date:** 2026-09-22
**Status:** Approved (master spec §8 + user Q&A 2026-09-22)
**Parent spec:** `2026-09-20-planit-design.md` §8 (binding); equipment spec
`2026-09-22-planit-equipment-and-card-design.md` (data shapes).

## Deltas vs master spec §8 (user-decided today)

- **No intro/closing pages for now** — the PDF is the per-session pages only
  (cover/closing return in a later pass).
- **Rows show equipment AND movement type** on both share and print views:
  equipment as icon + name (the row's chosen variant, else the move's
  default), movement type as a small chip. Move images fall back to the
  resolved equipment icon, then the generic placeholder.

## Data (new, public-safe)

`src/services/share.ts`:

- `getSharedPlan(slug)` — looked up by `share_slug`, `deleted_at IS NULL`,
  no coach session required. Returns `SharedPlan`:
  `{ coach: { name, title, phone, logoUrl, brandColor }, client: { name },
  plan: { title, updatedAt }, sessions: [{ label, weekday, focusNote,
  warmupLines, cardioTime, cardioHrm, rows: [{ exercise: { name, imageUrl,
  tutorialUrl }, movementType, equipment: { name, imageUrl } | null,
  sets, reps, speed, oneRm, rest, note }] }] }` — rows resolve
  `row.equipment ?? move default` server-side; no ids leak beyond what the
  page needs; returns `null` for unknown/revoked slugs.
- `getPlanForPrint(coachId, planId)` — same payload, coach-scoped by id
  (for the coach-only print route; works without a share slug).

## Routes

```
/p/[slug]              public share view (no app chrome, noindex, NO loading.tsx)
/p/[slug]/print        public print view (same payload)
/plans/[planId]/print  coach-only print view (auth via middleware + requireCoachId)
```

Unknown/revoked slug → friendly full-page "This link is no longer active."
(not the app 404). All three render without the app shell (own route-group
layouts). `noindex,nofollow` robots meta on all public routes.

## Share view `/p/[slug]`

Branded from the COACH profile, not Planit: page accent = `coach.brandColor`
(inline CSS var override of `--color-brand`), header with logo (when set),
coach name + title + phone, client name and plan title. Then:

- **Day switcher**: horizontally scrollable chips (like the editor's, read-
  only selection, local state), one session on screen.
- Per day: optional focus note; warm-up list with highlighted lines rendered
  as the emphasized brand strip; exercise cards — thumbnail (fallback chain),
  name, movement-type chip, equipment chip (icon + name), the five value
  fields laid out compactly (empty ones omitted), note; optional cardio bar.
  Empty blocks omitted entirely.
- Tapping a move's image/name opens a **lightbox** (vaul bottom sheet):
  full image (or icon), name, chips, and a "Watch tutorial" button when
  `tutorialUrl` exists (opens new tab). View-only otherwise.
- **Download PDF** button → `/p/[slug]/print`.
- Always live (renders latest saved plan; `dynamic = 'force-dynamic'`).

## Print view (one shared component, two routes)

A4 template per the confirmed design, re-implemented as a React print
component driven by coach branding:

- One page per session (`break-after: page`), `@page { size: A4; margin }`.
- Page header: dark bar with brand-color bottom border — logo + coach
  name/title left, client name right.
- Day title (label + weekday), focus note, warm-up section with highlighted
  strip lines, workout table (move + type + equipment, sets/reps/speed/1RM/
  rest, note), cardio bar, footer with coach phone.
- On screen: page-shaped preview + a floating "Print / Save as PDF" button
  calling `window.print()` (hidden in print media). Export = the browser
  print dialog (no server-side PDF — master spec decision).

## Entry points

- Editor header ⋯ menu gains **Export PDF** → opens `/plans/[planId]/print`
  in a new tab (the previously hidden Export).
- Plan card ⋯ menu gains **Export PDF** (same target).
- Share view's Download PDF → the public print route.

## Constraints

Strict TS; no automated tests; live DB untouched (read-only feature — no
schema change, no migration); local-first editor untouched; Base UI rules;
bottom sheets for the lightbox; public pages must not add `loading.tsx`;
mobile-first with the standing visual gate (390 + 1280 screenshots).

## Verification

Capstone on the real slug `testslug12ab`: share page at 390 + 1280 (brand
color applied, chips switch days locally, lightbox + tutorial button,
equipment/type chips, fallback icons), revoked/unknown slug page, print
routes (coach + public) render all sessions with page-break CSS present,
Export entry points navigate, cookie-less access to /p/* verified, noindex
meta present.
