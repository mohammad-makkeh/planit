<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Planit — agent guide

This file is the source of truth for working on Planit. The design specs and plans in
`docs/superpowers/` are **history**: they record how each module was first designed, and
several details there are now wrong (tags, move images, a print route, a `completed`
status). When the code, this file and a spec disagree, the code and this file win.

What to build next lives in [`BACKLOG.md`](BACKLOG.md) — work it top to bottom, one item at a
time.

---

## 1. Product

Planit is a mobile-first web app for **personal trainers (coaches)**. A coach manages
clients, builds workout plans from their move library, and delivers each plan to the client
as a **branded share link** (an app-like page) or a **branded PDF**.

- **Who it's for:** the coach. A feature earns its place if it makes the coach faster or
  makes the coach look better to their clients. Features aimed at the end client (the
  gym-goer) are in scope only when they serve the coach's delivery (the share page, the PDF).
- **Users today:** there is **one active coach** using Planit for real — a friend of the
  owner, unpaid, who knows it's still an alpha. His clients and plans are real data. The
  owner's own coach account ("Mohammad Makkeh") holds test data. Zero revenue.
- **Money:** everything must run at **zero cost** — Vercel Hobby, Supabase free tier, no paid
  APIs (no LLM calls, no paid services) until there's revenue.
- **Owner:** Mohammad Makkeh, a frontend engineer with a very high UI bar. He makes the
  product calls.

### Explicit non-goals (decided — don't propose these again)

- No client accounts, no workout logging or set tracking stored anywhere, no adherence data.
- No AI features that cost money (e.g. AI plan import) — revisit only after revenue.
- No training blocks, auto-progression or periodization.
- No grading of a coach's programming (e.g. "your chest volume is low") — telling coaches
  their programming is off hurts their ego; rejected.
- No move images (the body figure replaced them — see §5).
- No warm-up highlighting (removed).
- No automated tests (a standing decision) — keep code test-friendly (pure functions in
  `lib/`, logic in `services/`) but don't add test tooling.
- No offline/PWA, no plan versioning, no i18n yet (English only).

---

## 2. How the owner wants work done

These come from direct instructions and corrections. They are not suggestions.

### Quality bar

- **Code quality and consistency come first.** Match the surrounding code; don't patch
  things "in a weird way". Fix root causes, and when a fix belongs in a shared component, put
  it there so every caller gets it (e.g. keyboard handling lives in `BottomSheet`, not in
  each sheet).
- **The UI must be immaculate.** Every UI change is checked in a real browser at **390×844
  mobile emulation and a desktop width** before it's called done. Judge it like a designer:
  no horizontal overflow, consistent gutters, no clipped corners, tap targets ≥ ~36–40px,
  safe-area insets, sheet padding, no layout shift. A visual defect is a failing gate, just
  like a type error. (He was upset once when UI shipped with defects nobody had looked at.)
- Keep answers short and plain. When he asks for scope "briefly and casually", do exactly
  that.

### Commits and deploys

- Work on `master`. **Pushing to `master` deploys to production** (Vercel, automatic), and a
  real coach is using production.
- **Never push (deploy) until the owner explicitly says so.** Committing locally is fine;
  the push is the deploy, and it waits for his go-ahead every time.
- He may also say per task:
  - "don't commit until I see it" → leave the changes uncommitted, report, wait.
  - "one commit" → a single commit for the whole batch, so it can be reverted in one go.
- Database migrations touch production immediately (see §7), so they wait for the same
  go-ahead as a deploy.
- Commit message: conventional prefix (`feat:`, `fix:`, `docs:`, `chore:`), a short body
  explaining the why, and the co-author trailer on its own line after a blank line:

  ```
  Co-Authored-By: Claude <model name> <noreply@anthropic.com>
  ```

  Use the model name the harness gives you for attribution.

### Research and recommendations

- When asked for recommendations, research **Planit itself** — its code, flows, goal and
  constraints — and find where the coach's loop (build a plan fast → deliver it → look
  professional) has friction. Don't just copy features from consumer fitness apps.
- Give several ranked options with a recommendation, and respect the non-goals above.

---

## 3. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js **16** App Router, React 19, strict TypeScript |
| UI | Tailwind CSS v4 + shadcn (style `base-nova`, built on **Base UI**, not Radix) |
| Sheets | `vaul` (bottom sheets) |
| Drag & drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Forms | `react-hook-form` + `zod` (schemas shared client/server in `src/lib/validation.ts`) |
| Toasts | `sonner` |
| Icons | `lucide-react` |
| Avatars | `@blobatar/react` (deterministic from the client's name) |
| DB | Supabase Postgres via the transaction pooler (port 6543) + Drizzle ORM (`postgres-js`, `prepare: false`) |
| Storage | Supabase Storage, public bucket `planit-public` (coach logos only now) |
| Auth | Custom: bcrypt + JWT (`jose`) in an httpOnly cookie `planit_session`, 1-year sliding |
| PDF | `@react-pdf/renderer`, rendered server-side, fonts in `src/pdf-fonts/` (traced via `outputFileTracingIncludes` in `next.config.ts`) |
| Hosting | Vercel, functions pinned to **`fra1`** (`vercel.json`) |
| Database region | Supabase **eu-central-1 (Frankfurt)**, the same region as the functions |
| CI | GitHub Actions: typecheck, lint, build on every push; DB keep-alive ping Mon + Thu |

The database moved from Seoul to Frankfurt on 2026-09-23 for latency (the functions had
been running in US-East and talking to Seoul). The old Seoul Supabase project may still
exist; it's unused.

---

## 4. Architecture

```
src/app/            routes & layouts — thin: fetch via services, render
  (app)/            coach area (auth): /, /clients/[id], /clients/[id]/plans/[planId], /library, /settings
  (public)/         /login, /p/[slug] (share page), /p/[slug]/pdf (public PDF)
  (print)/          /plans/[planId]/pdf (coach PDF, auth)
src/actions/        server actions — validate with zod, call services, return ActionResult
src/services/       ALL business logic and Drizzle queries; the only layer that touches db/
src/db/             schema.ts, client.ts, seed.ts, seed-data.ts
src/lib/            auth, session, validation, format, storage, pdf-download, muscle-map/, utils
src/components/     ui/ (primitives), shared/, shell/, clients/, plans/, plan-editor/, library/, share/, pdf/, settings/
src/middleware.ts   auth gate + sliding cookie refresh (Next 16 prefers "proxy"; the rename is parked)
drizzle/            SQL migrations + meta snapshots/journal
public/equipment/   equipment icon SVGs
data/muscles.json   the muscle list the catalog was seeded from
```

Rules:

- Dependencies point down only: `app → actions → services → db`. Components never import
  `db/`.
- Every coach-owned service function takes `coachId` and scopes every query by it.
  Equipment and muscle targets are **global** (not coach-scoped).
- Server actions return `ActionResult<T>` (`ok()` / `err()` / `fromZod()` / `tryAction()` in
  `src/lib/action-result.ts`). Client code shows `result.error.message` in a toast.
- Reads: React Server Components calling services. Writes: server actions.
- `import 'server-only'` in services. Client components may import **types** from services.

### The plan editor is local-first

The editor (`src/components/plan-editor/plan-editor.tsx`) holds the whole plan document in
state and makes **zero server calls while editing**. All edits go through `mutate()`; a
single explicit **Save** sends the document to `savePlanDocumentAction` →
`savePlanDocument`, which deletes and re-inserts the plan's sessions and rows in one
transaction. There's a dirty counter, a `beforeunload` guard and a leave-confirm dialog.
Plan status (draft/active) is **not** part of the document: it's toggled from the plan card
on the client page (`PlanStatusSwitch`, optimistic, `updatePlanMetaAction`).

---

## 5. Domain model (current)

Postgres enums: `plan_status` = `draft | active`; `movement_type` = `push | pull | static`.

- **coaches** — email, password_hash, name, title, phone, logo_url, brand_color.
- **clients** — coach-scoped; name, phone, age, weight_kg, height_cm, notes; soft delete
  (`deleted_at`).
- **exercises** ("moves") — coach-scoped; name (unique per coach, case-insensitive),
  tutorial_url, movement_type, **default_equipment_id** (required). No image column.
  Hard delete, which cascades to plan rows (the UI warns with a usage count).
- **equipment** — **global** catalog (10 items): name, image_url (an icon in
  `public/equipment/`), `is_fallback` ("Any", exactly one). Edited in the database only.
- **exercise_equipment** — which equipment a move can use. The default must be one of them;
  in the move form the **first** picked equipment is the default.
- **muscle_targets** — **global** catalog of 18 muscles with a `position` for display order
  (anatomical, not alphabetical). Edited in the database only.
- **exercise_muscle_targets** — move ↔ muscle, with **`is_primary`** (primary vs secondary).
- **warmup_presets** — coach-scoped reusable warm-up lines.
- **plans** — coach + client, title, status, `share_slug` (null = not shared or revoked),
  soft delete.
- **plan_sessions** ("days") — position, label, weekday, `warmup_lines` jsonb
  `[{ "text": ... }]`, cardio_minutes, cardio_bpm, cardio_incline (0–15).
- **plan_rows** — position, exercise, sets, reps, rest (seconds), one_rm (%), speed (free
  text like `2/1/1`), note, `equipment_id` (null = use the move's default).

Numeric fields are integers. Their ranges are enforced in `planDocumentSchema` and clamped on
blur by `UnitInput` (`src/components/shared/unit-input.tsx`, which also hard-places the unit
suffix).

### The body muscle map (the app's signature visual)

- `src/lib/muscle-map/regions.ts` — front and back body polygons on a `0 0 100 200` viewBox,
  vendored from `react-body-highlighter` (MIT, license in the file). Two changes from the
  original: the chest is split into `chest-upper` / `chest-middle` / `chest-lower`, and a
  `side-deltoids` region is carved from the outer edge of the front and back delts. The same
  data draws the web SVG and the react-pdf `Svg`.
- `src/lib/muscle-map/index.ts` — `REGIONS_BY_MUSCLE` maps each catalog muscle (by lowercased
  name) to regions. **A muscle added or renamed in the DB draws nothing until it's added
  here.** Shading: on a single move, primary = full and secondary = 0.35. Across rows, each
  region is weighted by sets (no sets counts as 1, secondary counts half) and scaled to the
  busiest region. `focusViewBox` crops thumbnails to the worked area (one side only when
  nothing worked is near the midline). `formatSets` prints half sets.
- Components: `MuscleMap` (web figure), `MoveThumbnail` (a move's picture everywhere: body
  figure, else the equipment icon), `MuscleSummary` + `MuscleSummaryDialog` (the share page's
  "Today hits" card and full-screen view), `MusclePill`.
- Plan editor: a **Week** button next to the plan title opens the whole plan's balance; each
  "Not trained" muscle opens `GapSuggestions` in a `DialogSheet` to add a move to a day.
- PDF: the day banner carries the day's figure; each workout row has a cropped body
  thumbnail.

### Share page and PDF

- `/p/[slug]` is public, needs no login and always shows the latest saved plan. Its header
  mirrors the PDF header: a dark band with a brand-coloured bottom border, the coach's logo
  stacked over their name and title on the left, the client name and a PDF button on the
  right. Content is capped at `max-w-3xl`. Below: day tabs, the "Today hits" card, the
  warm-up `+` grid, cardio on one row with dividers, workout cards and a move lightbox.
- **Gym Mode** (`src/components/share/gym-mode/`): a `Start` pill in the day's Workout header
  opens a full-screen dark player — one move at a time, tappable set circles, an automatic rest
  countdown (Web Audio chime + vibration, one mute toggle), wake lock, a move list to jump around,
  and a finish screen that hands off to the story cards. Pure rules live in `src/lib/gym-mode.ts`.
  Progress is kept in `localStorage` for the plan + day + local date + plan `updatedAt` only;
  nothing is sent to the server. The open state is `?play=<day>` pushed with the history API, so
  the back button closes the player. Sheets over the player are `DialogSheet`s (it's a Base UI
  dialog). The player wraps its popup in the `dark` token scope with `--background` set to the
  header band's `#0f0f0f`; anything it portals out (the two sheets) gets the same class and style.
  **Rollout gate:** the pill and player stay hidden until a phone opens the share link with
  `?experimental_start=1` once; that visit stores `planit:gym:enabled` in `localStorage` and the
  feature then shows on that phone without the flag (`use-gym-enabled.ts`).
- The coach's `brand_color` is applied through the `--brand` CSS variable (Tailwind's `brand`
  colour reads `var(--brand)`), which is what lets the share page use the coach's colour.
- The PDF (`src/components/pdf/plan-pdf.tsx`) is laid out after
  `docs/reference/original-plan-template.html` (millimetres → points via `mm()`), one page per
  day, filename `<Client_Name>_Workout_Plan.pdf`. `downloadPdf()` in `src/lib/pdf-download.ts`
  fetches it as a blob and downloads it from the current page, with sonner loading/success
  toasts.

---

## 6. UI conventions

- **Form modals are bottom sheets on every viewport** (`src/components/ui/bottom-sheet.tsx`,
  vaul), with a drag handle. Small confirm or destructive prompts may be centred `Dialog`s.
- `BottomSheetContent` has `header` and `footer` slots rendered outside the scroll area (for
  pinned search bars and pinned Done buttons). The footer owns the bottom safe-area padding.
- `BottomSheet` turns off vaul's `repositionInputs` by default — it shoved sheets off-screen
  on the first keyboard open.
- A sheet opened from inside another sheet uses `BottomSheetNested` (vaul `NestedRoot`).
- A sheet that must open **over a Base UI `Dialog`** uses `DialogSheet`
  (`src/components/ui/dialog-sheet.tsx`): a nested Base UI dialog styled like a bottom sheet,
  closed with an X.
- Catalog pickers (equipment, muscles) are `CatalogPickerField`: removable pills plus a
  dashed "Add" pill that opens a nested picker sheet. Muscle pills toggle between primary
  (brand tint) and secondary (grey) on tap.
- Filter chips are `h-9` and rounded-full; primary actions are `h-9` or taller; icon buttons
  tapped on phones are at least `size-9`.
- Equipment icons are SVG files in `public/equipment/` (lucide style: 24px grid, round caps)
  drawn through `EquipmentIcon`, a CSS mask filled with `currentColor` — so an icon always
  matches its label's colour. Never render them as `<img>`, and never recolour with filters.
- Avatars are blobatar. No edge-to-edge containers; consistent gutters (`px-4`, `md:px-8`).
- Brand orange `#FE2E00` is the app default; coaches can override it.
- Copy is sentence case ("Add note", "Duplicate").

---

## 7. Gotchas (each one cost real time — read before touching the area)

### Base UI and vaul

- shadcn here is on **Base UI**: use the `render` prop, never `asChild`. Menu items use
  `onClick`, never `onSelect`. A `Select` needs the `items` prop on its root, or the trigger
  shows the raw value (a UUID).
- **Never put a Base UI popup (Select, Dialog, menu popup) inside a vaul sheet** — it goes
  inert or clicks through. Inside sheets use chip rows, plain buttons or nested vaul sheets.
  To show a confirm dialog from a sheet, hide the sheet while the dialog is open
  (`open={open && !deleteOpen}`).
- The reverse fails too: a vaul sheet over a modal Base UI dialog fights it for focus and
  outside presses. Use `DialogSheet`.
- A nested Base UI dialog's `Backdrop` only renders with `forceRender`. Give the popup
  `initialFocus`, or the first button gets auto-focused and flashes a focus ring.

### dnd-kit

- Sensors listen to `mousedown` / `touchstart`, so "don't start a drag from here" guards are
  `onMouseDown` / `onTouchStart` with `stopPropagation` (not `onPointerDown`). On exercise
  cards only the inputs, the note box and the kebab menu opt out; the move name and
  equipment pill still start a long-press drag. dnd-kit swallows the click after a drag, so a
  long-press doesn't also fire the button.
- Sortable ids must be **stable**, never array indexes (index ids made dropped warm-ups
  animate in from their old slots). Warm-up lines get client-only ids in `warmup-section.tsx`.
- Give every `DndContext` an `id` from `useId()`, or its generated `aria-describedby` ids
  cause a hydration mismatch.
- Dragged items use `rotate-2 border-brand bg-white shadow-lg` (`rotate` composes with
  dnd-kit's inline `transform`).

### CSS and layout

- Percentage **padding** resolves against the parent's **width**, not the element's own
  size: `p-[8%]` inside a 44px thumbnail left no room for its content.
- An SVG with `h-full w-auto` inside a flex item with no set width collapses to 0×0. Give
  the figure both dimensions (`size-full`) and let `preserveAspectRatio` letterbox it.

### Database and migrations

- **Dev and production share one database** (there's a single Supabase project). Anything you
  do locally, including test edits in the dev app, changes production data — and an active
  coach's real clients and plans live there. Only touch the owner's test account ("Mohammad
  Makkeh") when testing. Never delete or bulk-edit data outside it without the owner's
  explicit OK, and snapshot before any destructive change (into `.superpowers/*.json`, which
  is git-ignored).
- Never print `.env.local` or any secret. Read values into scripts with
  `node --env-file=.env.local`.
- Workflow: edit `src/db/schema.ts` → `npx drizzle-kit generate --name <name> < /dev/null` →
  review or hand-edit the SQL → apply.
  - `drizzle-kit generate` prompts on ambiguous renames (a dropped table plus a new table).
    Split the change into two schema steps and generate twice to avoid the prompt.
  - Data-only changes (e.g. reshaping jsonb) use `drizzle-kit generate --custom` with
    hand-written SQL.
- **Apply migrations with the drizzle-orm migrator, not `drizzle-kit migrate`** (its spinner
  once hid an error and applied nothing). Use a throwaway script in the repo root, so
  `node_modules` resolves:

  ```js
  // .tmp-migrate.mjs — run: node --env-file=.env.local .tmp-migrate.mjs, then delete it
  import postgres from 'postgres'
  import { drizzle } from 'drizzle-orm/postgres-js'
  import { migrate } from 'drizzle-orm/postgres-js/migrator'
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 60, onnotice: () => {} })
  await migrate(drizzle(sql), { migrationsFolder: './drizzle' })
  await sql.end()
  ```

- **Sequence migrations against the deploy**, because prod keeps running the old code until
  Vercel finishes:
  - additive changes (a new column or table) → migrate **before** pushing;
  - destructive or shape changes the old code can't handle (dropping a column, reshaping data
    the old validation requires) → push, wait for the deploy to succeed
    (`gh api repos/mohammad-makkeh/planit/commits/<sha>/status --jq .state` returns
    `success`), **then** migrate.
- If you must apply one migration file by hand, insert its row into
  `drizzle.__drizzle_migrations` (`hash` = sha256 of the SQL file's contents, `created_at` =
  the journal entry's `when`) so the migrator skips it later.
- The pooler sometimes times out on connect (`CONNECT_TIMEOUT`) from the owner's network.
  Retry; it's the network, not the code.

### Dev server

- Running `next build` while `next dev` is running overwrites the dev cache, and the dev
  server starts hanging or returning 500s. Restart it after any production build.
- To view coach pages in a browser, set the `planit_session` cookie to a signed token:

  ```bash
  node --env-file=.env.local -e "import('jose').then(async ({ SignJWT }) => console.log(await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject('<coach id>').setIssuedAt().setExpirationTime('30d').sign(new TextEncoder().encode(process.env.JWT_SECRET))))"
  ```

  Then run `document.cookie = "planit_session=<token>; path=/"` in the page and reload. Never
  print `JWT_SECRET` itself.
- Test fixtures (production rows in the owner's **test** account — safe to use for checks):
  - coach "Mohammad Makkeh": `9108d679-8570-4970-b6de-e19600205881`
  - client Ali Abbas Berro: `/clients/5e7ca94a-df57-419d-bec6-4c1b1236c240`
  - his plan: `/clients/5e7ca94a-df57-419d-bec6-4c1b1236c240/plans/cdc92ec4-5971-4d22-a2c6-86b7d84c8f0e`
  - its share link: `/p/ljFXxhEJ_1TM`
  - the other coach account ("Mohammad Al Khansa") is not a test fixture — don't use it for
    testing.
- To eyeball a PDF page: download it with `curl`, split a page out with `pypdf`, then convert
  it with `sips -s format png`.

### Production

- **Production URL: https://planitlb.vercel.app.** Smoke-test it after deploys, e.g.
  `curl -s -o /dev/null -w "%{http_code}" https://planitlb.vercel.app/p/ljFXxhEJ_1TM` (the
  share page and `/p/<slug>/pdf` are public; coach pages redirect to `/login`). The
  per-deployment `*.vercel.app` URLs redirect to Vercel's login (deployment protection), and
  the repo's GitHub homepage link is stale.
- Env vars live in Vercel's dashboard (`DATABASE_URL`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`), and changes need a redeploy. The Vercel CLI
  isn't installed.

---

## 8. Checks before calling something done

1. `npx tsc --noEmit` is clean.
2. `npx eslint src` has 0 errors. Two warnings are known and accepted:
   `react-hooks/incompatible-library` for react-hook-form's `watch` in `profile-form.tsx` and
   `exercise-form-sheet.tsx`.
3. `npx next build` passes for anything non-trivial (then restart the dev server).
4. Browser check at 390×844 and desktop (see §2), covering the flows you touched.
5. Migrations are applied in the right order relative to the deploy (see §7).

---

## 9. What's shipped (for orientation)

Foundation (auth, clients, library, settings) → plan editor (local-first, single Save) → UI
revisit (bottom sheets everywhere, blobatars) → equipment per move and per row → share page +
server-rendered PDF → typed numeric fields, cardio inputs, long-press drag, sticky day tabs →
move-form pickers as pills with nested sheets → global equipment and muscle-target catalogs →
body muscle map (thumbnails, day and week balance, primary/secondary, chest and side-delt
splits, PDF figures) → removal of move images and warm-up highlighting → Week-view gap
suggestions → share page polish → WhatsApp send + link preview → story cards → smart row
defaults → Gym Mode on the share page. Next up: [`BACKLOG.md`](BACKLOG.md).
