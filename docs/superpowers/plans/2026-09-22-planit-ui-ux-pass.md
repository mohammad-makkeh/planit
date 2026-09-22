# UI/UX Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Typed workout/cardio fields, editor ergonomics (long-press drag, status switch, sticky day tabs, structured cardio), an upload-only image picker, and a real one-click PDF styled after the original template.

**Architecture:** One migration turns four free-text columns into integers, restructures cardio, drops focus note and the `completed` status. The HTML print route is replaced by `@react-pdf/renderer` route handlers returning downloadable PDFs (spike-verified). UI work then layers on the new data shapes.

**Tech Stack:** unchanged + `@react-pdf/renderer` 4.9.0 (installed) and bundled TTFs in `src/pdf-fonts/`.

**Spec:** docs/superpowers/specs/2026-09-22-planit-ui-ux-pass-design.md
**PDF visual source of truth:** docs/reference/original-plan-template.html

## Global Constraints

- Strict TypeScript; NO automated tests. Gates per task: `npm run typecheck && npm run lint && npm run build` — zero errors (3 `react-hooks/incompatible-library` warnings = accepted baseline). **Every task must leave the tree green** — no staged breakage.
- **NEVER run `npm run db:migrate`, `db:push` or `db:seed`.** The DB is live production data; the controller runs the migration at capstone. Writing migration files is fine.
- Multi-tenancy: services stay coach-scoped; ownership checks on all client-supplied ids.
- Local-first editor: ZERO server calls while editing; only the explicit Save persists.
- shadcn wraps **Base UI, not Radix**: `render` prop (never `asChild`), menu items use `onClick` (never `onSelect`). Form modals are vaul `BottomSheet`s; never put a Base UI Select/Dialog popup inside a sheet.
- Mobile-first: tap targets ≥36px, 16px gutters, no horizontal overflow at 390px.
- Commit trailer, own line in the body after a blank line, exactly: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- Never push. Never dispatch subagents. One commit per task.

---

### Task 1: Data layer — typed columns, cardio restructure, drops

**Files:** `src/db/schema.ts`, `drizzle/0002_*.sql` (generate then replace), `src/db/seed-data.ts`, `src/db/seed.ts`, `src/lib/validation.ts`, `src/services/plans.ts`, `src/services/share.ts`, `src/services/exercises.ts`, plus the **mechanical** consumer updates needed to keep the tree green: `src/components/plan-editor/{plan-editor,session-panel,exercise-row-card,editor-header}.tsx`, `src/components/plans/plan-card-menu.tsx`, `src/components/share/{share-session,share-row-card,print-view}.tsx`, and any other file the compiler flags.

**Scope discipline:** this task changes *types and data*, not design. Keep every UI edit to the minimum that compiles and behaves sanely (e.g. a numeric `<Input type="number">` where a text one was, the `completed` option removed from the status Select). The redesigns are Tasks 2–6.

**Interfaces (produces):**
```ts
// schema
planRows:     sets integer · reps integer · rest integer · oneRm integer · speed text · note text
planSessions: cardioMinutes integer · cardioBpm integer · cardioIncline integer   // focusNote gone
planStatusEnum: ['draft','active']
// validation
docInt = (min,max) => z.number().int().min(min).max(max).nullable()
planDocumentSchema rows:     sets docInt(1,99) · reps docInt(1,999) · rest docInt(0,3600) · oneRm docInt(1,100) · speed docText(120) · note docText(500)
planDocumentSchema sessions: cardioMinutes docInt(1,999) · cardioBpm docInt(1,250) · cardioIncline docInt(0,15)   // focusNote removed
exerciseSchema: defaultEquipmentId REMOVED (service derives it from equipmentIds[0])
```

- [ ] **Step 1: schema.ts.** Apply the shapes above. `planStatusEnum` becomes `pgEnum('plan_status', ['draft','active'])`. Remove `focusNote`. Rename/retype the cardio columns (`cardio_minutes`, `cardio_bpm`, `cardio_incline`, all `integer()`). Retype `sets`/`reps`/`rest`/`oneRm` to `integer()`.

- [ ] **Step 2: migration.** Run `npm run db:generate`, then REPLACE the generated `drizzle/0002_*.sql` body with exactly this (keep the generated filename; the generated DDL would drop data):

```sql
ALTER TABLE "plan_rows" ALTER COLUMN "sets" TYPE integer USING NULLIF(substring("sets" from '[0-9]+'), '')::integer;--> statement-breakpoint
ALTER TABLE "plan_rows" ALTER COLUMN "reps" TYPE integer USING NULLIF(substring("reps" from '[0-9]+'), '')::integer;--> statement-breakpoint
ALTER TABLE "plan_rows" ALTER COLUMN "rest" TYPE integer USING NULLIF(substring("rest" from '[0-9]+'), '')::integer;--> statement-breakpoint
ALTER TABLE "plan_rows" ALTER COLUMN "one_rm" TYPE integer USING NULLIF(substring("one_rm" from '[0-9]+'), '')::integer;--> statement-breakpoint
ALTER TABLE "plan_sessions" ADD COLUMN "cardio_incline" integer;--> statement-breakpoint
UPDATE "plan_sessions" SET "cardio_incline" = LEAST(15, GREATEST(0, (substring("cardio_hrm" from 'incline[^0-9]*([0-9]+)'))::integer)) WHERE "cardio_hrm" ~ 'incline[^0-9]*[0-9]+';--> statement-breakpoint
ALTER TABLE "plan_sessions" ALTER COLUMN "cardio_time" TYPE integer USING NULLIF(substring("cardio_time" from '[0-9]+'), '')::integer;--> statement-breakpoint
ALTER TABLE "plan_sessions" ALTER COLUMN "cardio_hrm" TYPE integer USING NULLIF(substring("cardio_hrm" from '[0-9]+'), '')::integer;--> statement-breakpoint
ALTER TABLE "plan_sessions" RENAME COLUMN "cardio_time" TO "cardio_minutes";--> statement-breakpoint
ALTER TABLE "plan_sessions" RENAME COLUMN "cardio_hrm" TO "cardio_bpm";--> statement-breakpoint
ALTER TABLE "plan_sessions" DROP COLUMN "focus_note";--> statement-breakpoint
UPDATE "plans" SET "status" = 'active' WHERE "status" = 'completed';--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."plan_status" RENAME TO "plan_status_old";--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('draft', 'active');--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "status" TYPE "public"."plan_status" USING "status"::text::"public"."plan_status";--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
DROP TYPE "public"."plan_status_old";
```

Order is load-bearing: the incline is extracted while `cardio_hrm` is still text, and the enum swap needs the default dropped first. **Do not run the migration.**

- [ ] **Step 3: validation.ts.** Add `docInt` and apply the caps above; drop `focusNote`; drop `defaultEquipmentId` from `exerciseSchema` (and its `.refine`) — `equipmentIds` stays `.min(1)`.

- [ ] **Step 4: services.** `plans.ts`: `EditorSession`/`EditorRow` and `savePlanDocument` follow the new columns (no focus note, integer fields, cardio trio); `duplicatePlan` copies the new cardio columns. `share.ts`: `SharedSession` exposes `cardioMinutes`/`cardioBpm`/`cardioIncline` (numbers) and drops `focusNote`; `SharedRow` fields become `number | null` (keep `speed`/`note` strings). `exercises.ts`: `createExercise`/`updateExercise` set `defaultEquipmentId` to the FIRST id of the ownership-checked `equipmentIds` (preserve input order — do not let the ownership query reorder them), keeping the existing "default must be owned" guarantee implicitly.

- [ ] **Step 5: seed.** Update seeded rows/sessions to the new types (integers, cardio trio, no focus note, no `completed`).

- [ ] **Step 6: mechanical consumer updates.** Make every remaining consumer compile and behave: numeric inputs where the value is now a number (parse with `Number(e.target.value)`, empty → `null`), cardio trio rendered as three simple inputs for now, focus-note UI deleted, `completed` removed from the status Select and from `plan-card-menu`'s status cycle (make it a plain draft⇄active toggle item), share/print render the new fields (print-view keeps working — Task 5 deletes it).

- [ ] **Step 7: Gates.** — [ ] **Step 8: Commit** — `feat: typed workout fields, structured cardio, draft/active only` + trailer.

---

### Task 2: Move form — derived default equipment + upload-only image picker

**Files:** `src/components/shared/image-upload-field.tsx`, `src/components/library/exercise-form-sheet.tsx`, `src/components/library/equipment-form-sheet.tsx`, `src/components/library/equipment-multi-select.tsx`, `src/components/settings/profile-form.tsx`

- [ ] **Step 1: image picker redesign (shared component).** Empty state becomes a dashed-outline drop box (`rounded-xl border-2 border-dashed`, full width, ~112px tall, centered content): a low-opacity upload icon (`ImagePlus`, e.g. `opacity-40`) over a short muted hint ("Upload image" / "PNG, JPG or WebP"). The whole box is a `<button type="button">` that opens the file dialog, and it also accepts desktop drag-and-drop (`onDragOver` preventDefault + `onDrop` reading `dataTransfer.files[0]`, with a visible `border-brand` state while dragging over). Uploading state shows the spinner inside the box. **Filled state is unchanged** (thumbnail + remove button). Keep the existing upload action, folder prop, toasts and error handling exactly.
- [ ] **Step 2: delete the URL inputs.** Remove the separate "…or paste an image URL" `Input` (and any now-unused imports/labels) from `exercise-form-sheet.tsx`, `equipment-form-sheet.tsx` and the logo field in `profile-form.tsx`. The zod fields stay as they are (they still validate the uploaded URL).
- [ ] **Step 3: default equipment.** Delete the whole "Default equipment" section (chips/select and its handlers) from `exercise-form-sheet.tsx`; the form no longer sends `defaultEquipmentId` (Task 1 removed it from the schema). In `equipment-multi-select.tsx`, mark the FIRST selected chip with a small muted `· default` suffix so the rule is visible; selection order is the array order, so re-picking changes the default naturally.
- [ ] **Step 4: Gates.** — [ ] **Step 5: Commit** — `feat: upload-only image picker, default equipment derived from first pick` + trailer.

---

### Task 3: Editor chrome — cardio inputs, status switch, sticky day tabs

**Files:** create `src/components/ui/switch.tsx`; modify `src/components/plan-editor/session-panel.tsx`, `src/components/plan-editor/editor-header.tsx`, `src/components/plan-editor/plan-editor.tsx` (defaults + sticky layout), `src/components/plans/plan-card-menu.tsx` (status wording)

- [ ] **Step 1: `ui/switch.tsx`.** Wrap Base UI's `Switch` (`@base-ui/react/switch`) following the conventions of the existing wrappers (read `src/components/ui/select.tsx` first): `data-slot` attributes, `cn()` merging, brand-colored checked track, ≥36px hit area.
- [ ] **Step 2: cardio inputs.** In `session-panel.tsx` render the cardio block as three labelled fields with hard-placed units — a unit is a muted absolutely-positioned suffix inside the input (`pr-10` on the input, `absolute right-3 text-xs text-muted-foreground pointer-events-none`):
  - Minutes: `<Input type="number" inputMode="numeric" min={1} max={999}>` + `min`
  - Heart rate: same pattern, `min={1} max={250}` + `BPM`
  - Incline: a stepper row — `−` button, numeric input (`min={0} max={15}`) with a `%` suffix, `+` button; buttons are 36px, clamp at 0/15 and disable at the bounds.
  All are local-state edits through the existing session-field handler (zero server calls). Empty input → `null`.
- [ ] **Step 3: cardio defaults.** Where "Add cardio" initializes the block (Task 1 left it mechanical), set `cardioMinutes: 30`, `cardioBpm: null`, `cardioIncline: 0`. Removing the block sets all three to `null`.
- [ ] **Step 4: status switch.** In `editor-header.tsx` replace the Select with the Switch: label `Draft` / `Active` (or a single `Active` label with the switch reading on/off — pick the clearer one and keep it accessible with `aria-label="Plan status"`), wired to the existing `onStatusChange` with `'active' | 'draft'`. In `plan-card-menu.tsx` the status item reads `Mark as active` / `Mark as draft` based on the current status.
- [ ] **Step 5: sticky day tabs.** The day-chip row sticks directly beneath the sticky editor header while the session body scrolls. Read the header's current sticky offsets and give the chip row a matching `sticky top-[…]` with the same `bg-background/95 backdrop-blur` treatment and a `z-` below the header but above content. Verify no gap/overlap at 390px and that the chips keep their horizontal scroll.
- [ ] **Step 6: Gates.** — [ ] **Step 7: Commit** — `feat: structured cardio inputs, status switch, sticky day tabs` + trailer.

---

### Task 4: Move card — long-press drag, kebab note, field order and units

**Files:** `src/components/plan-editor/exercise-row-card.tsx`, `src/components/plan-editor/exercise-rows.tsx`, `src/components/plan-editor/session-chips.tsx`, `src/components/plan-editor/warmup-section.tsx`

- [ ] **Step 1: long-press drag.** Delete the `GripVertical` handle. Spread `attributes`/`listeners` on the card root instead, give the root `touch-action: manipulation` (Tailwind `touch-manipulation`) so scrolling still works, and change the row `DndContext` sensors to delay-based activation for BOTH pointer types: `MouseSensor` → `{ activationConstraint: { delay: 350, tolerance: 5 } }`, `TouchSensor` → `{ activationConstraint: { delay: 350, tolerance: 8 } }`. Wrap the interactive regions (the fields grid, the exercise-name button, the equipment chip, the kebab trigger) in a container with `onPointerDown={(e) => e.stopPropagation()}` so typing/tapping never starts a drag. Keyboard reorder must remain possible: keep `attributes` on the root (it carries the a11y props) and leave the existing `aria` labelling coherent.
- [ ] **Step 2: drag affordance + z-index (ALL THREE contexts).** While `isDragging`: brand border (`border-brand`) and raised stacking (`zIndex: 50` in the inline style plus `relative`), so the dragged element paints above its siblings. Apply the same z-index fix to `session-chips.tsx` and `warmup-section.tsx` sortable items — this is an app-wide bug, fix it in one pass, consistently.
- [ ] **Step 3: note into the kebab.** Remove the standalone note (`StickyNote`) toggle button; add a `Note` item (same icon) to the kebab menu alongside Duplicate and Remove that toggles the note field open. Keep the note textarea behavior identical.
- [ ] **Step 4: fields.** Reorder `FIELDS` to Sets · Reps · Rest · Speed · 1RM. Sets/Reps/Rest/1RM are numeric (`type="number" inputMode="numeric"` with the Task 1 min/max caps); Speed stays text. Rest and 1RM get hard-placed units (`sec`, `%`) using the same suffix pattern as Task 3's cardio inputs — extract that suffix markup into one small shared component or class so the editor has ONE unit-input pattern, not two.
- [ ] **Step 5: Gates.** — [ ] **Step 6: Commit** — `feat: long-press row drag, kebab note, reordered fields with units` + trailer.

---

### Task 5: Real PDF — react-pdf document, download routes, delete print views

**Files:** create `src/components/pdf/plan-pdf.tsx` (+ `src/components/pdf/fonts.ts` if it keeps things clean), `src/app/(print)/plans/[planId]/pdf/route.ts`, `src/app/(public)/p/[slug]/pdf/route.ts`; modify `next.config.ts`, `src/components/plan-editor/editor-header.tsx`, `src/components/plans/plan-card-menu.tsx`; DELETE `src/components/share/print-view.tsx`, `src/app/(public)/p/[slug]/print/`, `src/app/(print)/plans/[planId]/print/` (keep `src/app/(print)/layout.tsx` only if the new route still needs it — a route handler does not, so delete the group's layout too if nothing else uses it).

**Reference:** `docs/reference/original-plan-template.html` is the visual source of truth — read it fully and match its type scale, spacing, colors and composition. Fonts are already in `src/pdf-fonts/` (JockeyOne, KellySlab, Inter 400/600/700/800).

- [ ] **Step 1: document component.** A `@react-pdf/renderer` `<Document>` built from the existing `SharedPlan` payload, one `<Page size="A4">` per session. Register the fonts once at module scope from `join(process.cwd(), 'src/pdf-fonts', …)`. Match the template: dark `#0F0F0F` header band with a brand bottom border, coach block left (**logo with height only — `height: 27` and NO width, so the natural aspect is kept**; this is the reported crop bug) and client block right with a Kelly Slab `CLIENT` kicker; Kelly Slab day kicker + Jockey One uppercase day title; section heads (brand square + Kelly Slab label + hairline rule); warm-up as a two-column grid with brand `+` bullets and highlighted lines as the panel strip; **the cardio bar BEFORE the workout table** (bordered, dark `CARDIO` tag, then labelled stats — `TIME` `30 min`, `HEART RATE` `140 BPM`, `INCLINE` `8%` — omitting stats that are null); then the workout table with a dark head, brand-numbered uppercase exercise names, movement type + equipment as the small secondary line, and columns Sets · Reps · Rest · Speed · 1RM (units rendered with the values: `90 sec`, `75%`); em-dash for empty cells; footer rule with coach name left and phone right. Colors come from the coach's `brandColor` (fallback `#FE2E00`).
- [ ] **Step 2: routes.** Two `GET` route handlers returning the rendered buffer with `content-type: application/pdf` and `content-disposition: attachment; filename="<Client_Name>_Workout_Plan.pdf"` (client name slugified: non-alphanumerics → `_`). Coach route: `requireCoachId()` + uuid guard + `getPlanForPrint(coachId, planId)` → 404 response when null. Public route: slug validation + `getSharedPlan(slug)` → 404. Both `export const dynamic = 'force-dynamic'` and Node runtime.
- [ ] **Step 3: next.config.ts.** Add `outputFileTracingIncludes` so the TTFs ship with the serverless functions, e.g. `{ '/plans/[planId]/pdf': ['./src/pdf-fonts/**'], '/p/[slug]/pdf': ['./src/pdf-fonts/**'] }`. Keep the existing config intact.
- [ ] **Step 4: entry points.** Editor ⋯ and plan-card ⋯ "Export PDF" now point at `/plans/${planId}/pdf`. Keep the editor's ensure-saved guard and its synchronous-window-open pattern (a download navigation still benefits from it). Delete the print components/routes listed above and any now-dead imports.
- [ ] **Step 5: Gates.** — [ ] **Step 6: Commit** — `feat: one-click PDF download rendered from the original template` + trailer.

---

### Task 6: Share view — PDF-matching header, header PDF button, cardio units

**Files:** `src/components/share/share-header.tsx`, `src/components/share/share-view.tsx`, `src/components/share/share-session.tsx`

- [ ] **Step 1: header parity.** Rebuild the share header to mirror the PDF header's composition (dark band, brand bottom border, coach block left with logo + name + title, client block right with the Kelly Slab-style uppercase `CLIENT` kicker rendered in the web font stack) — same hierarchy and rhythm, adapted to a responsive web layout (stacks sensibly at 390px). **The logo must be height-constrained only** (e.g. `h-9 w-auto object-contain`) so it is never cropped.
- [ ] **Step 2: PDF button into the header.** Remove the big "Download PDF" button from the body; put a small icon+label button (`FileDown` + `PDF`, ≥36px) in the header's top-left area per the user's request, linking to `/p/${slug}/pdf` as a plain anchor (one-click download).
- [ ] **Step 3: cardio units.** Render the structured cardio with its units: `30 min`, `140 BPM`, `8%`, omitting null stats, matching the PDF's labelled-stat reading order.
- [ ] **Step 4: Gates.** — [ ] **Step 5: Commit** — `feat: share header matches PDF, inline PDF download, cardio units` + trailer.

---

## Post-plan (controller)

1. Run `npm run db:migrate` against the live DB; verify every parsed value against `.superpowers/pre-uiux-migration-snapshot.json` (sets/reps/rest/one_rm integers, cardio minutes/bpm/incline incl. the `incline 8` extraction, focus_note gone, enum has no `completed`).
2. Browser capstone at 390 + 1280: image dropzone (empty/drag/filled), default-equipment marker, cardio steppers with units and defaults, status switch, sticky day tabs while scrolling, long-press drag with brand border and correct stacking (rows AND chips AND warm-ups), kebab note, field order/units, editor zero-latency regression, share header + PDF button + cardio units.
3. Download both PDFs and open them: fonts, uncropped logo, cardio before table, page breaks, filename.
4. Final whole-branch review, one fix wave max, then merge + push (standing "deploy without asking" directive).
