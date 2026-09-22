# Planit — UI/UX Pass: Structured Fields, Editor Ergonomics, Real PDF

**Date:** 2026-09-22
**Status:** Approved (user list `some ui ux improvements.md`, 2026-09-22)
**Parents:** `2026-09-20-planit-design.md`, `2026-09-22-planit-equipment-and-card-design.md`,
`2026-09-22-planit-share-and-print-design.md` — this spec overrides them where noted.

## Spec deltas (explicit overrides of earlier approved decisions)

1. **PDF is generated server-side and downloads in one click.** Master spec §8 said
   "browser print dialog, no server-side PDF generation". The user now requires
   "one click that downloads the pdf, coach should not see more than that" — a print
   dialog cannot be bypassed, so this is only achievable with a real generator.
   Chosen: `@react-pdf/renderer` (4.9.0, React 19 peer OK) rendering to a Buffer in a
   Node route handler. **Spike-verified before adoption**: real 1-page vector PDF,
   custom TTFs (Jockey One / Kelly Slab / Inter) registered from local files and
   visually confirmed rendering, production build green. The HTML print routes and
   `print-view.tsx` are DELETED (dead code once the generator exists).
2. **Free-text workout fields become typed integers** (`sets`, `reps`, `rest` seconds,
   `one_rm` percent) — the master spec's "free-form strings" decision is overridden by
   the user's explicit "even in db and validations". `speed` stays free text (e.g. `2/1/1`).
3. **Cardio becomes structured**: `cardio_minutes`, `cardio_bpm`, `cardio_incline`
   (all integer) replace the two free-text columns.
4. **`completed` status is removed** (draft ⇄ active only) and **focus note is removed
   entirely** (column, UI, share, PDF).

Live data is compatible: every existing `sets`/`reps` value is already numeric, `rest` is
`"90 sec"`, `one_rm` is `"75%"`, cardio values carry parseable leading integers (one even
carries `incline 8`), no plan is `completed`, and the only two focus notes are `asdasd`
test junk. A pre-migration snapshot of every affected row is stored at
`.superpowers/pre-uiux-migration-snapshot.json`.

## Data model

```
plan_rows:     sets integer · reps integer · rest integer (seconds) · one_rm integer (percent)
               speed text (unchanged) · note text (unchanged)
plan_sessions: cardio_minutes integer · cardio_bpm integer · cardio_incline integer (0–15)
               focus_note DROPPED
plan_status:   enum('draft','active')   -- 'completed' removed
exercises:     default_equipment_id kept (load-bearing for row/share/PDF resolution),
               but no longer collected by the form — the service derives it from the
               first selected equipment id.
```

Ranges (zod + inputs): sets 1–99, reps 1–999, rest 0–3600, one_rm 1–100,
cardio_minutes 1–999, cardio_bpm 1–250, cardio_incline 0–15. All nullable.

## UI changes

### Move form
- **Default equipment field removed.** The first chosen equipment is the default; the
  first selected chip carries a small `· default` marker so the rule is visible.
- **Image picker redesign** (shared `ImageUploadField`, so move + equipment + settings
  logo all change together — consistency, not a per-form patch): empty state is a
  dashed-outline drop box with a low-opacity upload icon and a short hint, tappable
  (and drag-and-drop on desktop). Filled state keeps today's thumbnail + remove button.
  **The separate "…or paste an image URL" inputs are deleted everywhere** (upload only).

### Plan editor
- **Cardio block**: three typed inputs with hard-placed units — minutes (`min`, defaults
  to **30** when the block is added), heart rate (`BPM`, empty by default — never invent
  a client's heart rate), incline (`%`, defaults to **0**, a stepper with −/+ on either
  side, clamped 0–15).
- **Status**: the three-value Select becomes a two-state switch (Draft ⇄ Active). Needs a
  new `ui/switch.tsx` (Base UI, matching the existing shadcn wrapper conventions).
- **Focus note**: removed from the editor, share view and PDF.
- **Day tabs stick** directly under the existing sticky header while scrolling.

### Move card
- **No drag handle.** Long-press (hold) anywhere on the card that is not an input starts
  the drag; `touch-action: manipulation` keeps normal scrolling. Field/menu areas stop
  pointer propagation so typing never starts a drag.
- **Dragging affordance**: brand-colored border and a raised z-index so the dragged item
  renders above its siblings. The z-index fix is applied to **all three** sortable
  contexts (rows, session chips, warm-up lines) — the bug is app-wide.
- **Note button moves into the kebab menu** with Duplicate and Remove.
- **Field order**: Sets · Reps · Rest · Speed · 1RM. Sets/Reps are numeric inputs; Rest
  shows `sec`; 1RM shows `%`.

### PDF (new generator, styled after the original `plan.html`)
Recovered from git history (`141eadf:plan.html`) and used as the visual source of truth:
dark `#0F0F0F` header with a `1.4mm` brand underline, Kelly Slab letterspaced kickers and
section labels, Jockey One 42pt day titles, `+`-prefixed two-column warm-up grid, dark
table head, brand-numbered exercise names, bordered cardio bar with labelled stats, and a
thin footer rule with the coach phone.
- **Logo: height-constrained only** (`height: 9.5mm`, natural width) — fixes today's
  square crop, exactly as the original template did it.
- **Cardio renders BEFORE the workout table.**
- One page per session; fonts bundled as TTFs under `src/pdf-fonts/` and force-included
  in the serverless trace.
- Routes: `GET /plans/[planId]/pdf` (coach, auth + ownership) and `GET /p/[slug]/pdf`
  (public by slug), both returning `Content-Disposition: attachment` with filename
  `<Client_Name>_Workout_Plan.pdf`.
- Entry points (editor ⋯, plan card ⋯, share header) all become plain one-click
  downloads; the editor's ensure-saved guard stays (export must not ship stale data).

### Share view
- Header rebuilt to mirror the PDF header (same composition and hierarchy), with the logo
  height-constrained so it is no longer cropped.
- **PDF button moves into the header**, small, icon + `PDF` only.
- Cardio renders its units (`min` / `BPM` / `%`).

## Verification

Gates per task. Controller: run the migration against live DB and verify every parsed
value against the snapshot; browser capstone at 390 + 1280 covering each item above;
download both PDFs and open them to confirm fonts, logo aspect, cardio placement, page
breaks. Visual-gate rules apply (screenshots at both widths).
