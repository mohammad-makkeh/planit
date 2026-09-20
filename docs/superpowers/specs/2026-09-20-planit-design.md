# Planit — Design Spec

**Date:** 2026-09-20
**Status:** Approved design, pre-implementation
**Author:** Mohammad Makkeh + Claude (brainstorming session)

Planit is a mobile-first web app for personal trainers. A coach manages clients, builds
workout plans from a personal exercise library, and delivers each plan as a branded PDF
or an interactive share link. MVP targets one real coach (two isolated accounts),
designed multi-coach from day 1.

---

## 1. Goals & non-goals

### Goals (MVP)

- Coach logs in once (persistent session) and manages everything from a phone.
- Clients CRUD with profile fields and soft delete.
- Plans per client: create, edit, duplicate (in place / to another client), soft delete,
  status lifecycle, sorted newest first with visible dates.
- Exercise ("move") library with images, tutorial links, and multi-tag categorization;
  plans stay in live sync with the library.
- Warm-up presets library, reusable across all clients.
- Plan editor with autosave + explicit save, built for phone use.
- Public share link per plan: app-like, view-only, always shows the latest saved plan.
- Print/PDF export: the confirmed A4 branded template + hardcoded intro/closing pages.
- Coach profile & branding (name, title, phone, email, logo, brand color) driving the
  PDF and the share view.
- Immaculate, clean, professional UI. Mobile-first; works well on desktop.
- 100% free hosting and services.

### Non-goals (explicitly out of MVP)

- No automated tests (no Vitest/Testing Library/Playwright). Code must still be
  structured so tests can be added later (services layer, pure functions).
- No PWA/installability, no offline editing.
- No plan versioning/history; last-write-wins.
- No template pool (duplication covers reuse).
- No superset linking; coaches express supersets in exercise names/notes.
- No client login or client-side interactivity beyond viewing (image lightbox +
  tutorial link allowed).
- No analytics.
- No signup, no password reset UI (manual DB operation, documented in README).
- No i18n/RTL (English only; keep copy centralized to ease adding Arabic later).
- No custom domain (`*.vercel.app` for now).
- Free-text exercise rows are not allowed: every plan row references a library move.

---

## 2. Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 15, App Router, strict TypeScript | Frontend + backend in one project |
| Hosting | Vercel Hobby (free) | |
| Database | Supabase Postgres (free tier) | Via Supavisor transaction pooler |
| ORM | Drizzle | Schema, migrations, queries |
| File storage | Supabase Storage, public-read bucket | Move images + coach logos |
| Auth | Custom: bcrypt + JWT (jose) in httpOnly cookie | Supabase Auth deliberately not used |
| UI | Tailwind CSS + shadcn/ui | Design tokens centralized for later re-branding |
| Forms/validation | react-hook-form + zod | Zod schemas shared client/server |
| Client data | TanStack Query (plan editor only) | Server components elsewhere |
| PDF | Print-optimized route + browser print dialog | No server-side PDF generation |
| CI | GitHub Actions: install, typecheck, lint, build | Plus weekly DB keep-alive ping |

**Free-tier caveat:** Supabase pauses free projects after ~1 week of inactivity. A
weekly GitHub Actions cron pings the DB to keep it awake.

### Architecture layers (dependency-down only)

```
app/          routes & layouts — thin: rendering + wiring only
components/   shadcn base + Planit components; design tokens in one file
services/     ALL business logic and Drizzle queries; the only layer that touches db/
db/           Drizzle schema, migrations, seed scripts
lib/          auth helpers, zod schemas, shared utils
```

- Reads: React Server Components calling services.
- Writes: server actions calling services.
- No REST layer in MVP. If an API is ever needed, route handlers wrap the same
  services.
- Every service function takes the authenticated `coachId` and scopes every query by
  it (multi-coach isolation enforced in one layer).

---

## 3. Data model

All IDs are UUIDs. All tables carry `created_at`; mutable tables carry `updated_at`.
"Soft delete" = `deleted_at` timestamp; soft-deleted records are excluded from all
queries and dropdowns.

```
coaches
  id · email (unique) · password_hash · name · title · phone
  logo_url? · brand_color? · created_at · updated_at

clients
  id · coach_id → coaches · name · phone? · age? (int) · weight_kg? (numeric)
  height_cm? (numeric) · notes? (text) · deleted_at? · created_at · updated_at

exercises                                   -- "moves"
  id · coach_id → coaches · name · image_url? · tutorial_url?
  created_at · updated_at
  unique (coach_id, lower(name))
  HARD delete — see sync rules below

tags
  id · coach_id → coaches · name
  unique (coach_id, lower(name))

exercise_tags
  exercise_id → exercises (cascade) · tag_id → tags (cascade)
  composite primary key

warmup_presets
  id · coach_id → coaches · text · created_at

plans
  id · coach_id → coaches · client_id → clients · title
  status: 'draft' | 'active' | 'completed'   (enum; default 'draft')
  share_slug? (unique; null = never shared or revoked)
  deleted_at? · created_at · updated_at

plan_sessions
  id · plan_id → plans (cascade) · position (int) · label · weekday?
  focus_note? · warmup_lines (jsonb: [{ text: string, highlighted: boolean }])
  cardio_time? (text) · cardio_hrm? (text)

plan_rows
  id · session_id → plan_sessions (cascade) · position (int)
  exercise_id → exercises (ON DELETE CASCADE)
  sets? · reps? · speed? · one_rm? · rest? · note?     -- ALL free-form text
```

### Deliberate decisions

- **Free-form strings for row fields.** Real plans contain "1MIN", "75% 85%",
  "NEGATIVE CONTROL", "BOTTOM HALF 3SEC IN STRETCH". Inputs may offer smart helpers,
  but storage is text.
- **Library sync is live, both ways.** Plan rows join the exercise at read time —
  renaming a move updates every plan, share view, and export. Deleting a move
  cascade-deletes its rows from every plan, including active ones. The UI must show
  an impact count before deletion ("Used in 12 rows across 4 plans — deleting removes
  those rows permanently"). This was chosen over snapshotting; plans are never stale.
- **Exercises hard-delete; clients and plans soft-delete.** A soft-deleted exercise
  would contradict the sync rule.
- **Statuses:** draft → active → completed. Multiple active plans per client allowed.
  No archived status for plans (soft delete covers removal).
- **Dashboard recency** = `max(client.updated_at, max(their plans' updated_at))`,
  computed in the query. No denormalized `last_activity_at` column.
- **Warm-up lines** are content, not references: picking a preset copies its text into
  the session's `warmup_lines`. Editing/deleting a preset never touches plans.
- **Tags** cover both muscle groups and movement types in one coach-editable list
  (e.g. a move tagged `push` + `chest`). Multi-select, filterable, rendered as chips.
- **Cardio and focus note are optional** per session; the share/print views omit empty
  blocks.

---

## 4. Auth

- `coaches` table holds credentials (bcrypt hash). Two accounts seeded; each account
  is a fully isolated workspace (own clients, moves, tags, warm-ups, branding).
- Login: server action verifies credentials → signs JWT (jose, `sub = coachId`) →
  sets httpOnly, secure, SameSite=Lax cookie, 1-year expiry, refreshed (sliding) by
  middleware. Log in once, stays logged in.
- Middleware protects all routes except `/login`, `/p/*`, and static assets.
- Logout: Settings → clears cookie.
- Seed credentials come from environment variables at seed time; never committed.
- Password change/reset: manual DB operation for MVP, documented in README.

---

## 5. Routes & navigation

```
Public     /login
           /p/[slug]              client share view (view-only, app-like)
           /p/[slug]/print        print/PDF view via share slug
Protected  /                      dashboard: client list + search
           /clients/[id]          client profile + plans list
           /clients/[id]/plans/[planId]    plan editor
           /plans/[planId]/print  coach print/PDF view (no share required)
           /library               tabs: Moves · Warm-ups
           /settings              profile, branding, logout
```

- **Mobile:** bottom tab bar — Clients · Library · Settings — contextual headers,
  floating action button per screen (New client / New plan / New move).
- **Desktop:** same app with sidebar navigation; responsive composition, not separate
  layouts.
- Share and print routes render without app chrome. Share views are `noindex`.

---

## 6. Screens & behaviors

### Login
Minimal branded card: email, password, sign in. Generic error on bad credentials.

### Dashboard (Clients)
- Card list, not a table: initials avatar, name, phone, plan count with status dots,
  last-activity timestamp.
- Sorted by recency (see §3). Sticky fuzzy search over name and phone.
- Designed empty state inviting the first client. FAB: New client.

### Client profile
- Header: name, phone, chips for age/weight/height, notes. Edit and soft delete
  behind a ⋯ menu (delete requires confirmation; no undo toast).
- Plans as cards, newest first: title, status badge, created/updated dates.
- Per-plan actions: open · duplicate in place · duplicate to another client (client
  picker) · share · export PDF · change status · delete (soft, with confirmation).
- FAB: New plan (created as draft, opens editor immediately).

### Plan editor (the core screen; full UX detail in its own module pass)
- Sessions as swipeable tabs / accordion cards; add, reorder, duplicate day, delete.
- Per session: label + optional weekday, optional focus note,
  warm-up list, exercise rows, optional cardio block (time + heart rate, free text).
- Warm-up line entry: pick from presets (searchable) or type free text; one-tap
  "save to presets"; per-line highlight toggle (highlighted lines render as the
  emphasized strip in share/print views); reorder and delete lines.
- Exercise rows: mobile cards / desktop table. Exercise picker = searchable dropdown
  with image thumbnails and tag filter chips. Typing an unknown name offers
  **Create & add**: modal (name, image upload/URL, tutorial link, tags with inline
  tag creation) → saves to library and selects it in the row. Fields: sets, reps,
  speed, 1RM, rest, note. Reorder, duplicate, delete rows.
- Header: inline title edit, status selector, share sheet (generate link / copy /
  revoke), Export PDF, save indicator.

### Library
- **Moves tab:** search + tag filter chips; cards with image, name, tags. Create/edit
  modal identical to the inline one. Delete → impact-count dialog, permanent, removes
  rows from all plans (per sync rule).
- **Warm-ups tab:** simple list CRUD of preset lines.

### Settings
Coach profile & branding: name, title, phone, email, logo upload, brand color picker.
Logout. (These fields drive the share view and PDF header/footer.)

---

## 7. Saving model

- **Debounced autosave, 10 seconds** after the last field edit (deliberately long to
  keep request volume low on free tiers).
- Because the debounce is long, pending edits also **flush immediately** on: blur of
  the editor (visibilitychange/pagehide), in-app navigation away, the explicit Save
  button, and before structural operations.
- **Structural changes save immediately** (add/remove/reorder/duplicate of sessions
  and rows, status change, title change).
- Quiet indicator in the editor header: "Saving… / Saved ✓ / Unsaved changes".
- Explicit **Save** button flushes and confirms — this is the coach's mental
  checkpoint even though autosave exists.
- Concurrency: last-write-wins; no conflict handling (one coach per workspace).
- Every successful save bumps `plans.updated_at` (feeds recency sort and "updated"
  dates in lists).

---

## 8. Share view & print/PDF

### Share view `/p/[slug]`
- App-like and client-facing, branded from the coach profile (logo, name, title,
  phone, brand color) — not the Planit product brand.
- Day switcher (swipeable tabs) → per day: focus note, warm-up list (highlighted
  lines emphasized), exercise cards with image — tap opens a lightbox with the full
  image and a "Watch tutorial" button when a tutorial link exists — cardio block,
  and a Download PDF button → `/p/[slug]/print`.
- Always renders the latest saved plan (live, not a snapshot).
- Revoked/unknown slug → friendly "this link is no longer active" page.
- Slug: unguessable (nanoid ≥ 12 chars). Regenerating revokes the old link.

### Print/PDF
- One shared print component, two routes: public (`/p/[slug]/print`) and coach-only
  (`/plans/[planId]/print`).
- Layout: the confirmed A4 template — dark header (logo + coach identity left,
  client right), day title, warm-up section with highlighted strip, workout table,
  cardio bar, footer with coach phone — one page per session, plus a **hardcoded
  intro (cover) page and closing page** provided as static template images, with a
  small dynamic text layer on the cover for client name and date.
- Export = browser print dialog → Save as PDF (works on phone and desktop). No
  server-side PDF generation in MVP.

---

## 9. Validation, errors, conventions

- Zod schemas at every server-action boundary; the same schemas power
  react-hook-form on the client. One source of truth in `lib/`.
- Server actions return a typed `ActionResult<T>` — success with data, or a typed
  error (validation / not-found / unauthorized / unknown) so the UI never guesses.
- Global error boundary + toast system. Confirmation dialogs for destructive actions;
  no undo toasts in MVP.
- Designed empty, loading, and not-found states for every screen.
- Conventions: strict TS, no `any`; ESLint + Prettier; feature-oriented folders;
  services are the only DB consumers; components never import Drizzle.
- UI theming: all colors/typography as design tokens in one place. Product UI is a
  neutral, clean look with `#FE2E00` available as accent; coach branding applies to
  client-facing views. A dedicated brand/UI pass will follow (user will supply an
  additional design reference/skill) — the token layer is the seam that makes that
  cheap.

---

## 10. Seeding

Seed script (idempotent, run manually) creates:

- 2 coach accounts (credentials from env vars).
- ~40 exercises per coach: the moves from the real 5-day plan we digitized, plus
  common gym staples; images and tutorial links empty.
- Tags per coach: muscle groups (chest, back, shoulders, legs, arms, core, …) and
  movement types (push, pull, legs, …); seed exercises pre-tagged.
- A handful of warm-up presets per coach, lifted from the real plans (e.g.
  "Body weight squats 2 sets x 10", "Hip airplanes 2x12", plank/wall-sit lines).
- No demo clients or plans.

---

## 11. Delivery & CI

- Fresh git repo, created by the user (account switching); this project's existing
  one-off files (`data.json`, `plan.html`, the exported PDF) are deleted once the
  seed data is extracted from them.
- GitHub Actions on push: install, typecheck, lint, build. Weekly cron job pings the
  database (keep-alive). Nothing else.
- Deploy: Vercel Hobby. Environment variables documented in README:
  `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`,
  seed-time credentials.
- Product name: **Planit**.

---

## 12. Inputs needed from the user (before or during implementation)

1. Intro (cover) and closing page template images for the PDF.
2. Seed credentials for the two coach accounts (via env, at seed time).
3. Coach #1 branding: logo (have it), brand color (#FE2E00), name/title/phone (have).
4. The additional UI taste/brand reference ("skill") — for the post-MVP re-skin pass.

## 13. Follow-up module passes (agreed, not yet designed)

- Plan editor detailed UX.
- Share view detailed UX and its interactivity.
- Brand/visual design pass with the user's reference.
- Future (post-MVP, noted for context only): PWA, versioning/history, client
  interactivity, Arabic/RTL, more coaches/signup, custom domain, analytics.
