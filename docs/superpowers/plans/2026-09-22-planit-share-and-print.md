# Share View & Print/PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public share view at `/p/[slug]`, A4 print/PDF views (public + coach-only), and the Export entry points — read-only feature, no schema change.

**Architecture:** One public-safe service (`share.ts`) feeds three chrome-less routes; one shared print component behind both print routes; share view is a small client component tree over a server-fetched payload; coach brand color applied via a CSS-variable override.

**Tech Stack:** unchanged. No new dependencies.

**Spec:** docs/superpowers/specs/2026-09-22-planit-share-and-print-design.md

## Global Constraints

- Strict TS; NO automated tests. Gates per task: `npm run typecheck && npm run lint && npm run build` — zero errors (3 react-hooks/incompatible-library warnings = accepted baseline).
- **Never run db:migrate/db:push/db:seed** (live DB; this module is read-only anyway).
- Public routes: no session required for `/p/*` (middleware already allows); NO `loading.tsx` under `/p/*`; `robots: noindex,nofollow` metadata; no app shell (sidebar/bottom-nav) on share or print routes.
- Coach print route `/plans/[planId]/print` must verify ownership (requireCoachId + coach-scoped fetch → notFound()).
- Base UI rules (render prop, onClick); the lightbox is a vaul BottomSheet (`@/components/ui/bottom-sheet`) — never a Base UI popup inside sheets.
- Mobile-first; tap targets ≥36px; no horizontal overflow at 390px.
- Commit trailer, own line after a blank line, exactly: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Never push. Never dispatch subagents. One commit per task.

---

### Task 1: Public share/print data service

**Files:**
- Create: `src/services/share.ts`

**Interfaces (produces):**

```ts
export type SharedRow = {
  exercise: { name: string; imageUrl: string | null; tutorialUrl: string | null }
  movementType: 'push' | 'pull' | 'static'
  equipment: { name: string; imageUrl: string | null } | null
  sets: string | null; reps: string | null; speed: string | null
  oneRm: string | null; rest: string | null; note: string | null
}
export type SharedSession = {
  label: string; weekday: string | null; focusNote: string | null
  warmupLines: { text: string; highlighted: boolean }[]
  cardioTime: string | null; cardioHrm: string | null
  rows: SharedRow[]
}
export type SharedPlan = {
  coach: { name: string; title: string | null; phone: string | null; logoUrl: string | null; brandColor: string | null }
  client: { name: string }
  plan: { title: string; updatedAt: Date }
  sessions: SharedSession[]
}
export async function getSharedPlan(slug: string): Promise<SharedPlan | null>
export async function getPlanForPrint(coachId: string, planId: string): Promise<SharedPlan | null>
```

- [ ] **Step 1: implement.** `import 'server-only'`. Both functions share one internal loader: resolve the plan row first —
  - `getSharedPlan`: `plans.shareSlug = slug AND deletedAt IS NULL` (reject empty/overlong slug input cheaply first: `if (!/^[\w-]{8,32}$/.test(slug)) return null`).
  - `getPlanForPrint`: `plans.id = planId AND coachId AND deletedAt IS NULL`.
  Then load coach (name/title/phone/logoUrl/brandColor), client name, sessions ordered by position, rows ordered by position joined to exercises, plus each exercise's equipment links (mirror `getPlanForEditor`'s query structure in `src/services/plans.ts` — read it first). Resolve each row's equipment server-side: the row's `equipmentId` if it's among the move's linked equipment, else the move's `defaultEquipmentId`, else null; emit only `{name, imageUrl}`. Emit NO ids anywhere in the payload except none (pure display data). Return null when the plan/coach/client lookup fails.

- [ ] **Step 2: Gates.** — [ ] **Step 3: Commit** — `feat: public share/print plan payload service` + trailer.

---

### Task 2: Share view `/p/[slug]`

**Files:**
- Create: `src/app/(public)/p/[slug]/page.tsx` (RSC; NO loading.tsx anywhere under /p)
- Create: `src/components/share/share-view.tsx` (client root: day switcher state), `src/components/share/share-header.tsx`, `src/components/share/share-session.tsx`, `src/components/share/share-row-card.tsx`, `src/components/share/move-lightbox.tsx`, `src/components/share/link-inactive.tsx`

Recipes:
- **page.tsx**: `export const dynamic = 'force-dynamic'`; `generateMetadata` → `{ title: 'Workout Plan', robots: { index: false, follow: false } }`; await `getSharedPlan(slug)` (validate slug shape first); null → render `<LinkInactive />` (friendly full-page card: "This link is no longer active." + "Ask your coach for a new one." — no app chrome, no login link). Otherwise render `<ShareView plan={...} />`. Verify the (public) route group's layout renders no app shell (check how (public)/login does it).
- **Brand color**: the share root sets `style={{ '--color-brand': coach.brandColor ?? '#FE2E00' } as React.CSSProperties}` on the outermost div so every `bg-brand`/`text-brand` token inside follows the coach's color (verify the token name in globals.css — it's the var the `brand` Tailwind color reads; adapt to the actual var name).
- **share-header**: coach logo (img, only when logoUrl) + name + title + phone left/top; client name + plan title as the hero. Clean, mobile-first, 16px gutters.
- **share-view**: day chips row (reuse the visual language of the editor's session chips — plain buttons, brand-filled active, horizontal scroll, NO dnd), local `selected` state; renders the selected `<ShareSession />`.
- **share-session**: focus note (only when set), WARM-UP list — highlighted lines get the emphasized brand strip (`bg-brand/10 border-brand` like the editor's highlight), plain lines simple; rows; CARDIO bar (only when either field set) with time + heart-rate.
- **share-row-card**: thumbnail (exercise image → equipment icon → Dumbbell placeholder), name, movement-type chip (capitalized, muted outline), equipment chip (14px icon + name) when equipment resolves; the five values as compact label/value pairs, EMPTY FIELDS OMITTED; note in muted text under. Tapping the card opens the lightbox.
- **move-lightbox**: vaul BottomSheet; large image (or icon fallback, `max-h-[50dvh] object-contain`), name + both chips, and when `tutorialUrl` exists a full-width brand Button `render`ing an `<a href target="_blank" rel="noopener noreferrer">Watch tutorial</a>`.
- **Download PDF** button in the share view (prominent, after the chips or in the header) → plain `<a href={'/p/' + slug + '/print'}>`.

- [ ] Gates; Commit — `feat: public share view` + trailer.

---

### Task 3: Print component + both print routes

**Files:**
- Create: `src/components/share/print-view.tsx` (the shared A4 component)
- Create: `src/app/(public)/p/[slug]/print/page.tsx`
- Create: `src/app/(print)/plans/[planId]/print/page.tsx` + `src/app/(print)/layout.tsx` (minimal: just children — no app shell; the route stays middleware-protected since it's not under /p or /login)

Recipes:
- **print-view.tsx** (client component so the print button works): props `{ plan: SharedPlan, brand: string }`. Global print CSS via a `<style>` tag in the component: `@page { size: A4; margin: 0 }`, `@media print { .no-print { display: none } }`. Each session = one `.page` div: `width: 210mm; min-height: 297mm; break-after: page;` white background, internal padding ~10mm.
  Page structure (the confirmed template): dark header bar (#111-ish) with 3px bottom border in the brand color — left: logo img (when set, ~34px) + coach name (bold, white) + title (muted); right: client name (white) over plan title (muted, small). Below: day title row (session label large + weekday muted). Focus note when set. WARM-UP section: heading + lines, highlighted lines as a full-width brand-tinted strip (brand at ~12% background + 3px left border brand). Workout table: columns Move (name + small movement-type text + equipment icon+name) · Sets · Reps · Speed · 1RM · Rest, then note as a second muted row spanning the table when set; light row separators; empty value cells render "—". Cardio bar when set: single dark strip "CARDIO — {time}{ · hrm}". Footer pinned bottom of page: thin top border, coach phone right, coach name left, small muted.
  On screen (non-print): light gray page background, pages centered with shadow + gap, and a fixed bottom-right `.no-print` brand Button "Print / Save as PDF" → `onClick={() => window.print()}`.
- **Public print page**: mirror Task 2's page.tsx conventions (dynamic, noindex metadata, slug validation, LinkInactive on null — import it from components/share).
- **Coach print page**: `requireCoachId()` + `getPlanForPrint(coachId, planId)`; uuid-guard the param; `notFound()` on null. The `(print)` group layout returns `children` bare.
- Brand color: same CSS-var override wrapper as the share view.

- [ ] Gates; Commit — `feat: A4 print views for share link and coach export` + trailer.

---

### Task 4: Export entry points

**Files:**
- Modify: `src/components/plan-editor/editor-header.tsx` (⋯ menu gains "Export PDF")
- Modify: `src/components/plans/plan-card-menu.tsx` (menu gains "Export PDF")

Recipes: both menus get a `DropdownMenuItem` with a `FileDown` (lucide) icon labeled `Export PDF`, `onClick={() => window.open('/plans/' + planId + '/print', '_blank')}` — placed after Share, before the destructive separator. In the editor header, if unsaved changes exist the coach might export stale content: reuse the existing `onEnsureSaved` pattern (same as duplicate) so Export saves first when dirty, then opens the tab; aborts if the save fails. Plan-card menu needs no such guard (list context, nothing unsaved).

- [ ] Gates; Commit — `feat: export PDF entry points` + trailer.

---

## Post-plan (controller)

Capstone on the real slug `testslug12ab` (390 mobile emulation + 1280, plus a COOKIE-LESS context for /p/*): share page brand color applied, day chips switch locally (zero network), warm-up highlight strips, equipment + movement-type chips, image→icon fallbacks, lightbox with Watch-tutorial (add a tutorial URL to one move to verify, then remove), Download PDF → public print; unknown slug → inactive page; coach print route (authed) renders every session with `break-after` present and the print button hidden in print media; editor ⋯ Export saves-then-opens; plan-card Export opens. Screenshots both widths. Then final whole-branch review (fable), one fix wave max, finishing menu.
