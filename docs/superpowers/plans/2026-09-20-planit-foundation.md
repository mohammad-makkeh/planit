# Planit Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Planit foundation — scaffold, design tokens, database schema, auth, seed data, app shell, clients CRUD + dashboard, exercise library, warm-up presets, settings/branding, and CI — everything except the plan editor and share view (those get their own design passes).

**Architecture:** Next.js 15 App Router on Vercel; server components read and server actions write through a `services/` layer, the only code that touches Drizzle/Postgres (Supabase). Custom JWT-cookie auth. Supabase Storage for images via a server-side service key.

**Tech Stack:** Next.js 15 (React 19, strict TS), Tailwind CSS v4 + shadcn/ui, Drizzle ORM + postgres-js, Supabase (Postgres + Storage), jose, bcryptjs, zod, react-hook-form, nanoid.

**Spec:** `docs/superpowers/specs/2026-09-20-planit-design.md`

## Global Constraints

- **No automated tests in MVP** (explicit user decision overriding TDD default). Every task verifies via `npm run typecheck`, `npm run lint`, and a manual check in the dev server, exactly as written in its steps.
- Strict TypeScript, `"strict": true`, no `any` (use `unknown` + narrowing).
- Services are the ONLY consumers of `db/`; components and `app/` never import Drizzle.
- Every service function takes `coachId: string` as its first parameter and scopes every query by it.
- Soft-deleted rows (`deleted_at IS NOT NULL`) are excluded from every read; exercises hard-delete (cascade removes plan rows).
- All plan-row measurement fields are free-form `text` (never numeric).
- Product name is **Planit** everywhere user-visible.
- Node ≥ 20. Package manager: npm.
- Design tokens live only in `src/app/globals.css` (`@theme`); components use token classes, never hex values.
- Every commit message ends with the trailer line: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` (all commit steps below say "commit with trailer" — always use this exact line).
- Env vars (documented in README, never committed): `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `SEED_COACH1_EMAIL`, `SEED_COACH1_PASSWORD`, `SEED_COACH1_NAME`, `SEED_COACH2_EMAIL`, `SEED_COACH2_PASSWORD`, `SEED_COACH2_NAME`.

## Prerequisites (performed by the user, not by tasks)

1. Create the fresh git repo (user does this themselves — account switching) and run all tasks inside it. Delete `data.json`, `plan.html`, and the exported PDF from the old folder after copying `logo.png` and both docs folders (`docs/superpowers/...`) into the new repo.
2. Create a free Supabase project. From Project Settings copy: the **transaction pooler** connection string (port 6543) → `DATABASE_URL`; the project URL → `SUPABASE_URL`; the service role key → `SUPABASE_SERVICE_ROLE_KEY`.
3. In Supabase Storage, create a **public** bucket named `planit-public`.
4. Create `.env.local` at the repo root with all env vars above (`JWT_SECRET` = any 32+ char random string; seed vars = the two coaches' real credentials).

## File Structure

```
src/
  middleware.ts                        session guard + sliding refresh
  app/
    globals.css                        Tailwind v4 + design tokens (@theme)
    layout.tsx                         root layout (fonts, Toaster)
    (public)/login/page.tsx            login screen
    (app)/layout.tsx                   app shell: bottom tabs (mobile) / sidebar (desktop)
    (app)/page.tsx                     dashboard (client list + search)
    (app)/clients/[id]/page.tsx        client profile + plans list (read-only)
    (app)/library/page.tsx             tabs: Moves · Warm-ups
    (app)/settings/page.tsx            profile/branding + logout
  components/
    ui/…                               shadcn components (generated)
    shell/bottom-nav.tsx · shell/sidebar.tsx · shell/page-header.tsx · shell/fab.tsx
    shell/empty-state.tsx
    clients/client-card.tsx · clients/client-form-dialog.tsx · clients/client-search.tsx
    clients/client-actions-menu.tsx · clients/plan-list.tsx
    library/exercise-card.tsx · library/exercise-form-dialog.tsx
    library/exercise-delete-dialog.tsx · library/tag-filter.tsx · library/tag-multi-select.tsx
    library/warmups-tab.tsx
    settings/profile-form.tsx
  services/
    clients.ts · exercises.ts · tags.ts · warmups.ts · coaches.ts · plans.ts
  actions/
    auth.ts · clients.ts · exercises.ts · tags.ts · warmups.ts · coaches.ts · uploads.ts
  db/
    schema.ts · client.ts · seed.ts · seed-data.ts
  lib/
    auth.ts                            hash/verify password, sign/verify JWT
    session.ts                         requireCoachId() for RSC/actions
    action-result.ts                   ActionResult<T> + helpers
    storage.ts                         uploadImage() to Supabase Storage
    validation.ts                      all zod schemas
    utils.ts                           cn() etc. (shadcn-generated)
drizzle/                               generated SQL migrations
drizzle.config.ts
.github/workflows/ci.yml · .github/workflows/keepalive.yml
```

---

### Task 1: Scaffold Next.js app and tooling

**Files:**
- Create: entire app via `create-next-app`, then `tsconfig.json` tweaks, `.prettierrc`, `package.json` scripts

**Interfaces:**
- Produces: running Next.js 15 app with strict TS, ESLint, Tailwind v4, `@/*` path alias; scripts `dev`, `build`, `lint`, `typecheck`, `format`.

- [ ] **Step 1: Scaffold**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --turbopack
```

(Repo root is the fresh repo the user created. Answer "no" to any extra prompts.)

- [ ] **Step 2: Add scripts and Prettier**

In `package.json` add to `"scripts"`:

```json
"typecheck": "tsc --noEmit",
"format": "prettier --write .",
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:seed": "tsx src/db/seed.ts"
```

Create `.prettierrc`:

```json
{ "semi": false, "singleQuote": true, "trailingComma": "all" }
```

Install: `npm i -D prettier tsx`

- [ ] **Step 3: Verify tsconfig strictness**

Open `tsconfig.json`; confirm `"strict": true` (create-next-app default). Add `"noUncheckedIndexedAccess": true` to `compilerOptions`.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run dev`
Expected: no errors; http://localhost:3000 renders the Next.js starter page.

- [ ] **Step 5: Commit with trailer**

```bash
git add -A && git commit -m "chore: scaffold Next.js 15 app with strict TS, Tailwind, ESLint, Prettier"
```

---

### Task 2: Design tokens + shadcn/ui

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Create: `components.json`, `src/components/ui/*` (generated), `src/lib/utils.ts` (generated)

**Interfaces:**
- Produces: token classes (`bg-background`, `text-foreground`, `text-brand`, `bg-brand`, etc.) and shadcn components: button, input, textarea, label, dialog, dropdown-menu, badge, tabs, sonner, avatar, skeleton, select, form.

- [ ] **Step 1: Init shadcn**

```bash
npx shadcn@latest init -y
npx shadcn@latest add button input textarea label dialog dropdown-menu badge tabs sonner avatar skeleton select form
```

- [ ] **Step 2: Add Planit tokens to `src/app/globals.css`**

After the shadcn-generated `@theme inline` block, extend the `:root` custom properties it generated (keep shadcn's neutral scale) and add brand tokens inside the `@theme inline` block:

```css
@theme inline {
  /* …existing shadcn mappings… */
  --color-brand: #fe2e00;
  --color-brand-foreground: #ffffff;
}
```

Set the shadcn `--primary` custom property in `:root` to near-black (`oklch(0.145 0 0)`, the default) — the product UI stays neutral; `brand` is the accent per spec §9.

- [ ] **Step 3: Fonts + Toaster in root layout**

Replace `src/app/layout.tsx` content:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Planit',
  description: 'Workout plans for coaches',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run dev`
Expected: starter page renders in Inter; no console errors.

- [ ] **Step 5: Commit with trailer**

```bash
git add -A && git commit -m "feat: design tokens and shadcn/ui base components"
```

---

### Task 3: Drizzle schema, migrations, db client

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`
- Generated: `drizzle/0000_*.sql`

**Interfaces:**
- Produces: `db` (drizzle instance) from `@/db/client`; tables `coaches, clients, exercises, tags, exerciseTags, warmupPresets, plans, planSessions, planRows`; enum `planStatusEnum`; type `WarmupLine = { text: string; highlighted: boolean }`. Inferred row types via `typeof coaches.$inferSelect` etc.

- [ ] **Step 1: Install**

```bash
npm i drizzle-orm postgres && npm i -D drizzle-kit dotenv
```

- [ ] **Step 2: Write `src/db/schema.ts`**

```ts
import { sql } from 'drizzle-orm'
import {
  pgTable, pgEnum, uuid, text, integer, doublePrecision,
  timestamp, jsonb, primaryKey, uniqueIndex,
} from 'drizzle-orm/pg-core'

export type WarmupLine = { text: string; highlighted: boolean }

export const planStatusEnum = pgEnum('plan_status', ['draft', 'active', 'completed'])

const id = uuid('id').primaryKey().defaultRandom()
const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow().notNull().$onUpdate(() => new Date())

export const coaches = pgTable('coaches', {
  id,
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  title: text('title'),
  phone: text('phone'),
  logoUrl: text('logo_url'),
  brandColor: text('brand_color'),
  createdAt,
  updatedAt,
})

export const clients = pgTable('clients', {
  id,
  coachId: uuid('coach_id').notNull().references(() => coaches.id),
  name: text('name').notNull(),
  phone: text('phone'),
  age: integer('age'),
  weightKg: doublePrecision('weight_kg'),
  heightCm: doublePrecision('height_cm'),
  notes: text('notes'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt,
  updatedAt,
})

export const exercises = pgTable('exercises', {
  id,
  coachId: uuid('coach_id').notNull().references(() => coaches.id),
  name: text('name').notNull(),
  imageUrl: text('image_url'),
  tutorialUrl: text('tutorial_url'),
  createdAt,
  updatedAt,
}, (t) => [uniqueIndex('exercises_coach_name_uq').on(t.coachId, sql`lower(${t.name})`)])

export const tags = pgTable('tags', {
  id,
  coachId: uuid('coach_id').notNull().references(() => coaches.id),
  name: text('name').notNull(),
}, (t) => [uniqueIndex('tags_coach_name_uq').on(t.coachId, sql`lower(${t.name})`)])

export const exerciseTags = pgTable('exercise_tags', {
  exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.exerciseId, t.tagId] })])

export const warmupPresets = pgTable('warmup_presets', {
  id,
  coachId: uuid('coach_id').notNull().references(() => coaches.id),
  text: text('text').notNull(),
  createdAt,
})

export const plans = pgTable('plans', {
  id,
  coachId: uuid('coach_id').notNull().references(() => coaches.id),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  title: text('title').notNull(),
  status: planStatusEnum('status').notNull().default('draft'),
  shareSlug: text('share_slug').unique(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt,
  updatedAt,
})

export const planSessions = pgTable('plan_sessions', {
  id,
  planId: uuid('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  label: text('label').notNull(),
  weekday: text('weekday'),
  focusNote: text('focus_note'),
  warmupLines: jsonb('warmup_lines').$type<WarmupLine[]>().notNull().default(sql`'[]'::jsonb`),
  cardioTime: text('cardio_time'),
  cardioHrm: text('cardio_hrm'),
})

export const planRows = pgTable('plan_rows', {
  id,
  sessionId: uuid('session_id').notNull().references(() => planSessions.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  sets: text('sets'),
  reps: text('reps'),
  speed: text('speed'),
  oneRm: text('one_rm'),
  rest: text('rest'),
  note: text('note'),
})
```

- [ ] **Step 3: Write `src/db/client.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Supavisor transaction pooler requires prepare: false
const client = postgres(process.env.DATABASE_URL!, { prepare: false })
export const db = drizzle(client, { schema })
```

- [ ] **Step 4: Write `drizzle.config.ts`**

```ts
import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: '.env.local' })

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
```

- [ ] **Step 5: Generate and run migration**

Run: `npm run db:generate && npm run db:migrate`
Expected: a `drizzle/0000_*.sql` file; migration applies without error. Verify in Supabase Table Editor that all 9 tables exist.

- [ ] **Step 6: Verify types**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit with trailer**

```bash
git add -A && git commit -m "feat: database schema, migrations, and drizzle client"
```

---

### Task 4: ActionResult + zod validation schemas

**Files:**
- Create: `src/lib/action-result.ts`, `src/lib/validation.ts`

**Interfaces:**
- Produces:
  - `ActionResult<T>`, `ok<T>(data): ActionResult<T>`, `err(code, message, fieldErrors?)`, `fromZod(error): ActionResult<never>` from `@/lib/action-result`
  - Schemas from `@/lib/validation`: `loginSchema`, `clientSchema`, `exerciseSchema`, `tagSchema`, `warmupSchema`, `profileSchema` and their `z.infer` types `LoginInput`, `ClientInput`, `ExerciseInput`, `TagInput`, `WarmupInput`, `ProfileInput`.

- [ ] **Step 1: Install zod + form deps**

```bash
npm i zod react-hook-form @hookform/resolvers
```

- [ ] **Step 2: Write `src/lib/action-result.ts`**

```ts
import type { ZodError } from 'zod'

export type ActionErrorCode = 'validation' | 'not_found' | 'unauthorized' | 'conflict' | 'unknown'

export type ActionError = {
  code: ActionErrorCode
  message: string
  fieldErrors?: Record<string, string[]>
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError }

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function err(
  code: ActionErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): { ok: false; error: ActionError } {
  return { ok: false, error: { code, message, fieldErrors } }
}

export function fromZod(error: ZodError): { ok: false; error: ActionError } {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root'
    ;(fieldErrors[key] ??= []).push(issue.message)
  }
  return err('validation', 'Please fix the highlighted fields.', fieldErrors)
}
```

- [ ] **Step 3: Write `src/lib/validation.ts`**

```ts
import { z } from 'zod'

/** '' or null → undefined, else Number — for optional numeric form fields */
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().positive().optional(),
)

const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .optional()

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const clientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  phone: optionalTrimmed,
  age: optionalNumber,
  weightKg: optionalNumber,
  heightCm: optionalNumber,
  notes: optionalTrimmed,
})
export type ClientInput = z.infer<typeof clientSchema>

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  imageUrl: optionalTrimmed.pipe(z.string().url('Enter a valid URL').optional()),
  tutorialUrl: optionalTrimmed.pipe(z.string().url('Enter a valid URL').optional()),
  tagIds: z.array(z.string().uuid()).default([]),
})
export type ExerciseInput = z.infer<typeof exerciseSchema>

export const tagSchema = z.object({
  name: z.string().trim().min(1, 'Tag name is required'),
})
export type TagInput = z.infer<typeof tagSchema>

export const warmupSchema = z.object({
  text: z.string().trim().min(1, 'Warm-up text is required'),
})
export type WarmupInput = z.infer<typeof warmupSchema>

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  title: optionalTrimmed,
  phone: optionalTrimmed,
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  brandColor: optionalTrimmed.pipe(
    z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #FE2E00').optional(),
  ),
  logoUrl: optionalTrimmed.pipe(z.string().url().optional()),
})
export type ProfileInput = z.infer<typeof profileSchema>
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit with trailer**

```bash
git add -A && git commit -m "feat: ActionResult type and zod validation schemas"
```

---

### Task 5: Auth primitives + middleware

**Files:**
- Create: `src/lib/auth.ts` (JWT + cookie config, edge-safe), `src/lib/password.ts` (bcrypt, node-only), `src/lib/session.ts`, `src/middleware.ts`

**Interfaces:**
- Produces:
  - `@/lib/auth`: `SESSION_COOKIE = 'planit_session'`, `signSession(coachId: string): Promise<string>`, `verifySessionToken(token: string): Promise<string | null>`, `sessionCookieOptions`
  - `@/lib/password`: `hashPassword(pw: string): Promise<string>`, `verifyPassword(pw: string, hash: string): Promise<boolean>`
  - `@/lib/session`: `getCoachId(): Promise<string | null>`, `requireCoachId(): Promise<string>` (redirects to `/login` when absent)
- Note: JWT and bcrypt are split into two files because middleware runs on the edge runtime — it must never import bcryptjs.

- [ ] **Step 1: Install**

```bash
npm i jose bcryptjs server-only
```

- [ ] **Step 2: Write `src/lib/auth.ts`**

```ts
import { SignJWT, jwtVerify } from 'jose'

const SESSION_DURATION_S = 60 * 60 * 24 * 365 // 1 year, sliding (middleware re-issues)

export const SESSION_COOKIE = 'planit_session'

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DURATION_S,
}

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 32) throw new Error('JWT_SECRET must be set and 32+ chars')
  return new TextEncoder().encode(s)
}

export async function signSession(coachId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(coachId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_S}s`)
    .sign(secret())
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload.sub ?? null
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Write `src/lib/password.ts`**

```ts
import 'server-only'
import bcrypt from 'bcryptjs'

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

- [ ] **Step 4: Write `src/lib/session.ts`**

```ts
import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, verifySessionToken } from './auth'

export async function getCoachId(): Promise<string | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}

export async function requireCoachId(): Promise<string> {
  const coachId = await getCoachId()
  if (!coachId) redirect('/login')
  return coachId
}
```

- [ ] **Step 5: Write `src/middleware.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import {
  SESSION_COOKIE, sessionCookieOptions, signSession, verifySessionToken,
} from '@/lib/auth'

const PUBLIC_PATHS = [/^\/login$/, /^\/p\//]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((re) => re.test(pathname))
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const coachId = token ? await verifySessionToken(token) : null

  if (!coachId && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (coachId && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const response = NextResponse.next()
  if (coachId) {
    // sliding expiry: re-issue the cookie on every authenticated request
    response.cookies.set(SESSION_COOKIE, await signSession(coachId), sessionCookieOptions)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
}
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run dev`, open http://localhost:3000
Expected: redirected to `/login` (404 for now — the page arrives in Task 6). No middleware errors in the terminal.

- [ ] **Step 7: Commit with trailer**

```bash
git add -A && git commit -m "feat: JWT cookie auth primitives and route-guard middleware"
```

---

### Task 6: Coaches service + login/logout

**Files:**
- Create: `src/services/coaches.ts`, `src/actions/auth.ts`, `src/app/(public)/login/page.tsx`

**Interfaces:**
- Consumes: Task 4 (`loginSchema`, `ActionResult`, `err`), Task 5 (auth/password/session helpers)
- Produces:
  - `@/services/coaches`: `type Coach` (= `typeof coaches.$inferSelect`), `findCoachByEmail(email: string): Promise<Coach | undefined>` (auth entry point — the one unscoped service function), `getCoach(coachId: string): Promise<Coach | undefined>`, `updateCoachProfile(coachId: string, input: ProfileInput): Promise<Coach>`
  - `@/actions/auth`: `loginAction(prev: unknown, formData: FormData)`, `logoutAction()`

- [ ] **Step 1: Write `src/services/coaches.ts`**

```ts
import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { coaches } from '@/db/schema'
import type { ProfileInput } from '@/lib/validation'

export type Coach = typeof coaches.$inferSelect

/** Auth entry point — deliberately not coach-scoped. */
export function findCoachByEmail(email: string): Promise<Coach | undefined> {
  return db.query.coaches.findFirst({ where: eq(coaches.email, email) })
}

export function getCoach(coachId: string): Promise<Coach | undefined> {
  return db.query.coaches.findFirst({ where: eq(coaches.id, coachId) })
}

export async function updateCoachProfile(coachId: string, input: ProfileInput): Promise<Coach> {
  const [updated] = await db
    .update(coaches)
    .set({
      name: input.name,
      title: input.title ?? null,
      phone: input.phone ?? null,
      email: input.email,
      brandColor: input.brandColor ?? null,
      logoUrl: input.logoUrl ?? null,
    })
    .where(eq(coaches.id, coachId))
    .returning()
  if (!updated) throw new Error('Coach not found')
  return updated
}
```

- [ ] **Step 2: Write `src/actions/auth.ts`**

```ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, sessionCookieOptions, signSession } from '@/lib/auth'
import { verifyPassword } from '@/lib/password'
import { loginSchema } from '@/lib/validation'
import { err, type ActionResult } from '@/lib/action-result'
import { findCoachByEmail } from '@/services/coaches'

export async function loginAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<never>> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return err('validation', 'Enter your email and password.')

  const coach = await findCoachByEmail(parsed.data.email)
  const valid = coach && (await verifyPassword(parsed.data.password, coach.passwordHash))
  if (!coach || !valid) return err('unauthorized', 'Wrong email or password.')

  const store = await cookies()
  store.set(SESSION_COOKIE, await signSession(coach.id), sessionCookieOptions)
  redirect('/')
}

export async function logoutAction(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect('/login')
}
```

- [ ] **Step 3: Write `src/app/(public)/login/page.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { loginAction } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [result, formAction, pending] = useActionState(loginAction, null)

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Planit</h1>
          <p className="text-sm text-muted-foreground">Sign in to your workspace</p>
        </div>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {result && !result.ok && (
            <p className="text-sm text-destructive" role="alert">{result.error.message}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run dev`
Expected: `/login` renders; submitting any credentials shows "Wrong email or password." (no coaches exist until Task 7 — full login verify happens there).

- [ ] **Step 5: Commit with trailer**

```bash
git add -A && git commit -m "feat: coaches service, login and logout"
```

---

### Task 7: Seed data + seed script

**Files:**
- Create: `src/db/seed-data.ts`, `src/db/seed.ts`
- Modify: `package.json` (`db:seed` script)

**Interfaces:**
- Consumes: Task 3 (`db`, schema tables)
- Produces: `SEED_EXERCISES: { name: string; tags: string[] }[]`, `SEED_WARMUPS: string[]`, `TAG_NAMES` from `@/db/seed-data`; idempotent `npm run db:seed` that seeds both coaches from env.
- Note: seed runs under `tsx`, NOT inside Next.js — it must import `bcryptjs` directly, never `@/lib/password` (the `server-only` guard throws outside Next).

- [ ] **Step 1: Fix the seed script env loading**

`src/db/client.ts` reads `DATABASE_URL` at import time, so dotenv must load before imports. In `package.json` change:

```json
"db:seed": "tsx --env-file=.env.local src/db/seed.ts"
```

- [ ] **Step 2: Write `src/db/seed-data.ts`**

```ts
export const TAG_NAMES = [
  'chest', 'back', 'shoulders', 'legs', 'glutes', 'arms',
  'biceps', 'triceps', 'core', 'calves', 'push', 'pull',
] as const

export type SeedExercise = { name: string; tags: string[] }

export const SEED_EXERCISES: SeedExercise[] = [
  // From the digitized 5-day plan
  { name: 'Leg curl (seated or lying)', tags: ['legs'] },
  { name: 'Hack squat', tags: ['legs'] },
  { name: 'Sumo squat', tags: ['legs', 'glutes'] },
  { name: 'Leg press', tags: ['legs'] },
  { name: 'Leg extension', tags: ['legs'] },
  { name: 'Lying leg raises', tags: ['core'] },
  { name: 'Standing calf raise', tags: ['calves', 'legs'] },
  { name: 'Squat', tags: ['legs', 'glutes'] },
  { name: 'Walking lunges', tags: ['legs', 'glutes'] },
  { name: 'Single leg hip thrust', tags: ['glutes', 'legs'] },
  { name: 'Sit ups', tags: ['core'] },
  { name: 'Plank', tags: ['core'] },
  { name: 'Incline smith machine press', tags: ['chest', 'push'] },
  { name: 'Incline cable fly', tags: ['chest', 'push'] },
  { name: 'Machine fly', tags: ['chest', 'push'] },
  { name: 'Dumbbell press soft decline', tags: ['chest', 'push'] },
  { name: 'Shoulder dumbbell press', tags: ['shoulders', 'push'] },
  { name: 'Shoulder machine press', tags: ['shoulders', 'push'] },
  { name: 'Lateral raises', tags: ['shoulders'] },
  { name: 'Incline dumbbell Y raise', tags: ['shoulders'] },
  { name: 'Front rope raise', tags: ['shoulders'] },
  { name: 'Incline dumbbell curl', tags: ['biceps', 'arms'] },
  { name: 'Reverse barbell curl', tags: ['biceps', 'arms'] },
  { name: 'Preacher curl machine', tags: ['biceps', 'arms', 'pull'] },
  { name: 'Rope overhead extension', tags: ['triceps', 'arms', 'push'] },
  { name: 'Single arm push down', tags: ['triceps', 'arms', 'push'] },
  { name: 'V-bar push down', tags: ['triceps', 'arms', 'push'] },
  { name: 'Upper abs plated', tags: ['core'] },
  { name: 'T-bar row wide grip', tags: ['back', 'pull'] },
  { name: 'Seated row narrow grip', tags: ['back', 'pull'] },
  { name: 'Lat pull down wide grip', tags: ['back', 'pull'] },
  { name: 'Seated face pull', tags: ['shoulders', 'back', 'pull'] },
  { name: 'Incline dumbbell shrug row', tags: ['back', 'pull'] },
  { name: 'Hyperextension weighted', tags: ['back', 'glutes'] },
  // Common staples
  { name: 'Bench press', tags: ['chest', 'push'] },
  { name: 'Deadlift', tags: ['back', 'legs', 'pull'] },
  { name: 'Romanian deadlift', tags: ['legs', 'glutes', 'pull'] },
  { name: 'Pull ups', tags: ['back', 'pull'] },
  { name: 'Barbell curl', tags: ['biceps', 'arms'] },
  { name: 'Overhead press', tags: ['shoulders', 'push'] },
  { name: 'Dips', tags: ['chest', 'triceps', 'push'] },
  { name: 'Cable crunch', tags: ['core'] },
]

export const SEED_WARMUPS: string[] = [
  'Body weight squats 2 sets x 10',
  'Hip airplanes 2x12',
  'Reverse snow angels (scapular retraction)',
  'Hip mobility drills, dynamic stretches',
  'Band shoulder dislocates 10 rep x 3',
  'Face pulls 2x20 / light DB lateral raises',
  'Dynamic stretch (arm circles forward and backward)',
  'Dead hang',
  'Scap pull-ups 2x12',
  'Band pull aparts 2x20',
  'Cat cow stretch',
  'Cobra stretch',
  'Jefferson curl 10kg',
  'Plank 1 min constant',
]
```

- [ ] **Step 3: Write `src/db/seed.ts`**

```ts
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from './client'
import { coaches, exerciseTags, exercises, tags, warmupPresets } from './schema'
import { SEED_EXERCISES, SEED_WARMUPS, TAG_NAMES } from './seed-data'

type SeedCoach = { email: string; password: string; name: string }

function coachFromEnv(n: 1 | 2): SeedCoach {
  const email = process.env[`SEED_COACH${n}_EMAIL`]
  const password = process.env[`SEED_COACH${n}_PASSWORD`]
  const name = process.env[`SEED_COACH${n}_NAME`]
  if (!email || !password || !name) throw new Error(`Missing SEED_COACH${n}_* env vars`)
  return { email: email.toLowerCase(), password, name }
}

async function seedCoach(input: SeedCoach): Promise<void> {
  let coach = await db.query.coaches.findFirst({ where: eq(coaches.email, input.email) })
  if (!coach) {
    const [created] = await db
      .insert(coaches)
      .values({
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
        name: input.name,
      })
      .returning()
    coach = created
  }
  if (!coach) throw new Error(`Could not create coach ${input.email}`)
  const coachId = coach.id

  await db
    .insert(tags)
    .values(TAG_NAMES.map((name) => ({ coachId, name })))
    .onConflictDoNothing()
  const tagRows = await db.query.tags.findMany({ where: eq(tags.coachId, coachId) })
  const tagIdByName = new Map(tagRows.map((t) => [t.name, t.id]))

  await db
    .insert(exercises)
    .values(SEED_EXERCISES.map((e) => ({ coachId, name: e.name })))
    .onConflictDoNothing()
  const exerciseRows = await db.query.exercises.findMany({
    where: eq(exercises.coachId, coachId),
  })
  const exerciseIdByName = new Map(exerciseRows.map((e) => [e.name, e.id]))

  const links = SEED_EXERCISES.flatMap((e) => {
    const exerciseId = exerciseIdByName.get(e.name)
    if (!exerciseId) return []
    return e.tags.flatMap((t) => {
      const tagId = tagIdByName.get(t)
      return tagId ? [{ exerciseId, tagId }] : []
    })
  })
  if (links.length > 0) await db.insert(exerciseTags).values(links).onConflictDoNothing()

  const existing = await db.query.warmupPresets.findMany({
    where: eq(warmupPresets.coachId, coachId),
  })
  const existingTexts = new Set(existing.map((w) => w.text))
  const missing = SEED_WARMUPS.filter((t) => !existingTexts.has(t)).map((text) => ({
    coachId,
    text,
  }))
  if (missing.length > 0) await db.insert(warmupPresets).values(missing)

  console.log(`Seeded ${input.email}: ${exerciseRows.length} exercises, ${tagRows.length} tags`)
}

async function main(): Promise<void> {
  await seedCoach(coachFromEnv(1))
  await seedCoach(coachFromEnv(2))
  console.log('Seed complete')
  process.exit(0)
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 4: Run and verify idempotency**

Run: `npm run db:seed` twice.
Expected: both runs succeed; second run creates nothing new (same counts). Supabase Table Editor shows 2 coaches, 12 tags × 2, 42 exercises × 2, 14 warm-up presets × 2.

- [ ] **Step 5: Verify login end-to-end**

Run: `npm run dev` → `/login` → sign in with coach 1's seeded credentials.
Expected: redirect to `/` (starter page for now). Wrong password shows the error message.

- [ ] **Step 6: Commit with trailer**

```bash
git add -A && git commit -m "feat: idempotent seed script with coaches, exercises, tags, warm-ups"
```

---

### Task 8: Supabase Storage upload

**Files:**
- Create: `src/lib/storage.ts`, `src/actions/uploads.ts`

**Interfaces:**
- Consumes: Task 4 (`ActionResult`, `ok`, `err`), Task 5 (`requireCoachId`)
- Produces:
  - `@/lib/storage`: `uploadImage(file: File, folder: 'exercises' | 'logos'): Promise<string>` (returns public URL)
  - `@/actions/uploads`: `uploadImageAction(formData: FormData): Promise<ActionResult<{ url: string }>>` — expects fields `file` (File) and `folder` ('exercises' | 'logos')

- [ ] **Step 1: Install**

```bash
npm i @supabase/supabase-js nanoid
```

- [ ] **Step 2: Write `src/lib/storage.ts`**

```ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { nanoid } from 'nanoid'

const BUCKET = 'planit-public'

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  return createClient(url, key)
}

export async function uploadImage(
  file: File,
  folder: 'exercises' | 'logos',
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${folder}/${nanoid(12)}.${ext}`
  const supabase = supabaseAdmin()
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    cacheControl: '31536000',
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
```

- [ ] **Step 3: Write `src/actions/uploads.ts`**

```ts
'use server'

import { err, ok, type ActionResult } from '@/lib/action-result'
import { requireCoachId } from '@/lib/session'
import { uploadImage } from '@/lib/storage'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function uploadImageAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  await requireCoachId()
  const file = formData.get('file')
  const folder = formData.get('folder')

  if (!(file instanceof File) || file.size === 0) return err('validation', 'Choose an image file.')
  if (file.size > MAX_BYTES) return err('validation', 'Image must be 5MB or smaller.')
  if (!ALLOWED_TYPES.includes(file.type)) return err('validation', 'Use a JPG, PNG, or WebP image.')
  if (folder !== 'exercises' && folder !== 'logos') return err('validation', 'Invalid upload folder.')

  try {
    const url = await uploadImage(file, folder)
    return ok({ url })
  } catch (e) {
    return err('unknown', e instanceof Error ? e.message : 'Upload failed')
  }
}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS. (Functional verify happens with the library UI in Task 14.)

- [ ] **Step 5: Commit with trailer**

```bash
git add -A && git commit -m "feat: image upload to Supabase Storage"
```

---

### Task 9: App shell (nav, header, FAB, empty state, error boundary)

**Files:**
- Create: `src/components/shell/bottom-nav.tsx`, `src/components/shell/sidebar.tsx`, `src/components/shell/page-header.tsx`, `src/components/shell/fab.tsx`, `src/components/shell/empty-state.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/error.tsx`, `src/app/(app)/page.tsx` (placeholder, replaced in Task 11)
- Delete: `src/app/page.tsx` (starter page — it would conflict with `(app)/page.tsx`)

**Interfaces:**
- Consumes: Task 5 (`requireCoachId`)
- Produces: `<BottomNav />`, `<Sidebar />`, `<PageHeader title action? />`, `<Fab label onClick />`, `<EmptyState icon? title description? action? />`; the `(app)` route group renders children inside the shell (bottom tabs on mobile, sidebar on desktop).

- [ ] **Step 1: Install icons (if shadcn init didn't)**

```bash
npm i lucide-react
```

- [ ] **Step 2: Write `src/components/shell/bottom-nav.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dumbbell, Settings, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/', label: 'Clients', icon: Users },
  { href: '/library', label: 'Library', icon: Dumbbell },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname.startsWith('/clients')
  return pathname.startsWith(href)
}

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="grid grid-cols-3">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 text-xs font-medium',
              isActive(pathname, href) ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <Icon className={cn('size-5', isActive(pathname, href) && 'text-brand')} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 3: Write `src/components/shell/sidebar.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dumbbell, Settings, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/', label: 'Clients', icon: Users },
  { href: '/library', label: 'Library', icon: Dumbbell },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname.startsWith('/clients')
  return pathname.startsWith(href)
}

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r bg-background md:flex">
      <div className="px-6 py-6 text-2xl font-bold tracking-tight">
        Plan<span className="text-brand">it</span>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive(pathname, href)
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/50',
            )}
          >
            <Icon className={cn('size-4', isActive(pathname, href) && 'text-brand')} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 4: Write `src/components/shell/page-header.tsx`**

```tsx
import type { ReactNode } from 'react'

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-8">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      {action}
    </header>
  )
}
```

- [ ] **Step 5: Write `src/components/shell/fab.tsx`**

```tsx
'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className="fixed bottom-20 right-4 z-40 h-14 rounded-full px-5 shadow-lg md:bottom-8 md:right-8"
    >
      <Plus className="size-5" />
      {label}
    </Button>
  )
}
```

- [ ] **Step 6: Write `src/components/shell/empty-state.tsx`**

```tsx
import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-10 text-center">
      {icon}
      <p className="font-semibold">{title}</p>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
```

- [ ] **Step 7: Write `src/app/(app)/layout.tsx`, `error.tsx`, placeholder page; delete starter page**

`src/app/(app)/layout.tsx`:

```tsx
import { requireCoachId } from '@/lib/session'
import { BottomNav } from '@/components/shell/bottom-nav'
import { Sidebar } from '@/components/shell/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireCoachId() // defense in depth beyond middleware
  return (
    <div className="min-h-dvh md:pl-56">
      <Sidebar />
      <main className="pb-24 md:pb-8">{children}</main>
      <BottomNav />
    </div>
  )
}
```

`src/app/(app)/error.tsx`:

```tsx
'use client'

import { Button } from '@/components/ui/button'

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-semibold">Something went wrong</p>
      <p className="text-sm text-muted-foreground">Your data is safe — try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
```

`src/app/(app)/page.tsx` (temporary):

```tsx
import { PageHeader } from '@/components/shell/page-header'

export default function DashboardPage() {
  return <PageHeader title="Clients" />
}
```

Delete `src/app/page.tsx`.

- [ ] **Step 8: Verify**

Run: `npm run typecheck && npm run dev` → log in → `/`
Expected: shell renders — bottom tabs at phone width (use responsive dev tools), sidebar at desktop width; tabs navigate to `/library` and `/settings` (404 pages for now).

- [ ] **Step 9: Commit with trailer**

```bash
git add -A && git commit -m "feat: app shell with mobile bottom nav and desktop sidebar"
```

---

### Task 10: Clients service + actions

**Files:**
- Create: `src/services/clients.ts`, `src/actions/clients.ts`
- Modify: `src/lib/action-result.ts` (add `tryAction`)

**Interfaces:**
- Consumes: Tasks 3–5 (`db`, schema, `clientSchema`, `ActionResult`, `requireCoachId`)
- Produces:
  - `@/lib/action-result`: `tryAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>>`
  - `@/services/clients`: `type Client`, `type ClientListItem = Client & { planCount: number; lastActivityAt: Date }`, `listClients(coachId, search?): Promise<ClientListItem[]>`, `getClient(coachId, clientId): Promise<Client | undefined>`, `createClient(coachId, input: ClientInput): Promise<Client>`, `updateClient(coachId, clientId, input: ClientInput): Promise<Client | undefined>`, `softDeleteClient(coachId, clientId): Promise<boolean>`
  - `@/actions/clients`: `createClientAction(input: unknown)`, `updateClientAction(clientId: string, input: unknown)`, `deleteClientAction(clientId: string)`

- [ ] **Step 1: Add `tryAction` to `src/lib/action-result.ts`**

```ts
export async function tryAction<T>(
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn()
  } catch (e) {
    console.error(e)
    return err('unknown', 'Something went wrong. Please try again.')
  }
}
```

- [ ] **Step 2: Write `src/services/clients.ts`**

```ts
import 'server-only'
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { clients, plans } from '@/db/schema'
import type { ClientInput } from '@/lib/validation'

export type Client = typeof clients.$inferSelect
export type ClientListItem = Client & { planCount: number; lastActivityAt: Date }

const lastActivity = sql<Date>`greatest(${clients.updatedAt}, coalesce(max(${plans.updatedAt}), ${clients.updatedAt}))`

export async function listClients(coachId: string, search?: string): Promise<ClientListItem[]> {
  const filters = [eq(clients.coachId, coachId), isNull(clients.deletedAt)]
  const q = search?.trim()
  if (q) {
    const like = `%${q}%`
    const nameOrPhone = or(ilike(clients.name, like), ilike(clients.phone, like))
    if (nameOrPhone) filters.push(nameOrPhone)
  }
  const rows = await db
    .select({ client: clients, planCount: sql<number>`count(${plans.id})::int`, lastActivityAt: lastActivity })
    .from(clients)
    .leftJoin(plans, and(eq(plans.clientId, clients.id), isNull(plans.deletedAt)))
    .where(and(...filters))
    .groupBy(clients.id)
    .orderBy(desc(lastActivity))
  return rows.map((r) => ({ ...r.client, planCount: r.planCount, lastActivityAt: r.lastActivityAt }))
}

export function getClient(coachId: string, clientId: string): Promise<Client | undefined> {
  return db.query.clients.findFirst({
    where: and(eq(clients.id, clientId), eq(clients.coachId, coachId), isNull(clients.deletedAt)),
  })
}

function toRow(input: ClientInput) {
  return {
    name: input.name,
    phone: input.phone ?? null,
    age: input.age ?? null,
    weightKg: input.weightKg ?? null,
    heightCm: input.heightCm ?? null,
    notes: input.notes ?? null,
  }
}

export async function createClient(coachId: string, input: ClientInput): Promise<Client> {
  const [created] = await db.insert(clients).values({ coachId, ...toRow(input) }).returning()
  if (!created) throw new Error('Insert returned no row')
  return created
}

export async function updateClient(
  coachId: string,
  clientId: string,
  input: ClientInput,
): Promise<Client | undefined> {
  const [updated] = await db
    .update(clients)
    .set(toRow(input))
    .where(and(eq(clients.id, clientId), eq(clients.coachId, coachId), isNull(clients.deletedAt)))
    .returning()
  return updated
}

export async function softDeleteClient(coachId: string, clientId: string): Promise<boolean> {
  const [deleted] = await db
    .update(clients)
    .set({ deletedAt: new Date() })
    .where(and(eq(clients.id, clientId), eq(clients.coachId, coachId), isNull(clients.deletedAt)))
    .returning({ id: clients.id })
  return deleted !== undefined
}
```

- [ ] **Step 3: Write `src/actions/clients.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { err, fromZod, ok, tryAction, type ActionResult } from '@/lib/action-result'
import { requireCoachId } from '@/lib/session'
import { clientSchema } from '@/lib/validation'
import {
  createClient, softDeleteClient, updateClient,
} from '@/services/clients'

export async function createClientAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = clientSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const client = await createClient(coachId, parsed.data)
    revalidatePath('/')
    return ok({ id: client.id })
  })
}

export async function updateClientAction(
  clientId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = clientSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const updated = await updateClient(coachId, clientId, parsed.data)
    if (!updated) return err('not_found', 'Client not found.')
    revalidatePath('/')
    revalidatePath(`/clients/${clientId}`)
    return ok({ id: updated.id })
  })
}

export async function deleteClientAction(clientId: string): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const deleted = await softDeleteClient(coachId, clientId)
    if (!deleted) return err('not_found', 'Client not found.')
    revalidatePath('/')
    return ok(null)
  })
}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit with trailer**

```bash
git add -A && git commit -m "feat: clients service and server actions"
```

---

### Task 11: Dashboard (client list, search, create)

**Files:**
- Create: `src/lib/format.ts`, `src/components/clients/client-search.tsx`, `src/components/clients/client-card.tsx`, `src/components/clients/client-form-dialog.tsx`, `src/components/clients/new-client-button.tsx`
- Modify: `src/app/(app)/page.tsx` (replace placeholder)

**Interfaces:**
- Consumes: Task 9 shell components, Task 10 (`listClients`, `createClientAction`, `updateClientAction`)
- Produces:
  - `@/lib/format`: `formatRelative(date: Date): string`, `formatDate(date: Date): string`, `initials(name: string): string`
  - `<ClientFormDialog open onOpenChange client? />` where `client?: { id: string; name: string; phone: string | null; age: number | null; weightKg: number | null; heightCm: number | null; notes: string | null }` — reused by Task 12 for editing.

- [ ] **Step 1: Write `src/lib/format.ts`**

```ts
export function formatRelative(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(date)
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}
```

- [ ] **Step 2: Write `src/components/clients/client-search.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function ClientSearch() {
  const router = useRouter()
  const params = useSearchParams()
  const [value, setValue] = useState(params.get('q') ?? '')

  useEffect(() => {
    const t = setTimeout(() => {
      const q = value.trim()
      router.replace(q ? `/?q=${encodeURIComponent(q)}` : '/')
    }, 300)
    return () => clearTimeout(t)
  }, [value, router])

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search clients…"
        className="pl-9"
        inputMode="search"
      />
    </div>
  )
}
```

- [ ] **Step 3: Write `src/components/clients/client-card.tsx`** (server component)

```tsx
import Link from 'next/link'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatRelative, initials } from '@/lib/format'
import type { ClientListItem } from '@/services/clients'

export function ClientCard({ client }: { client: ClientListItem }) {
  return (
    <Link
      href={`/clients/${client.id}`}
      className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/40 active:bg-accent/60"
    >
      <Avatar className="size-11">
        <AvatarFallback className="bg-brand/10 font-semibold text-brand">
          {initials(client.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{client.name}</p>
        <p className="truncate text-sm text-muted-foreground">{client.phone ?? 'No phone'}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Badge variant="secondary">
          {client.planCount} {client.planCount === 1 ? 'plan' : 'plans'}
        </Badge>
        <span className="text-xs text-muted-foreground">{formatRelative(client.lastActivityAt)}</span>
      </div>
    </Link>
  )
}
```

(`import type` from a service is safe in any component — types are erased at build.)

- [ ] **Step 4: Write `src/components/clients/client-form-dialog.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createClientAction, updateClientAction } from '@/actions/clients'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { clientSchema } from '@/lib/validation'

type FormValues = z.input<typeof clientSchema>

export type ClientFormClient = {
  id: string
  name: string
  phone: string | null
  age: number | null
  weightKg: number | null
  heightCm: number | null
  notes: string | null
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: ClientFormClient
}) {
  const form = useForm<FormValues>({ resolver: zodResolver(clientSchema) })
  const { register, handleSubmit, reset, setError, formState } = form

  useEffect(() => {
    if (open) {
      reset({
        name: client?.name ?? '',
        phone: client?.phone ?? '',
        age: client?.age ?? '',
        weightKg: client?.weightKg ?? '',
        heightCm: client?.heightCm ?? '',
        notes: client?.notes ?? '',
      } as FormValues)
    }
  }, [open, client, reset])

  const onSubmit = handleSubmit(async (values) => {
    const result = client
      ? await updateClientAction(client.id, values)
      : await createClientAction(values)
    if (!result.ok) {
      for (const [field, messages] of Object.entries(result.error.fieldErrors ?? {})) {
        setError(field as keyof FormValues, { message: messages[0] })
      }
      toast.error(result.error.message)
      return
    }
    toast.success(client ? 'Client updated' : 'Client added')
    onOpenChange(false)
  })

  const fieldError = (name: keyof FormValues) => formState.errors[name]?.message

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{client ? 'Edit client' : 'New client'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} autoFocus />
            {fieldError('name') && <p className="text-sm text-destructive">{fieldError('name')}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" inputMode="tel" {...register('phone')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input id="age" type="number" inputMode="numeric" {...register('age')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weightKg">Weight (kg)</Label>
              <Input id="weightKg" type="number" step="0.1" inputMode="decimal" {...register('weightKg')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="heightCm">Height (cm)</Label>
              <Input id="heightCm" type="number" step="0.1" inputMode="decimal" {...register('heightCm')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} {...register('notes')} />
          </div>
          <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? 'Saving…' : client ? 'Save changes' : 'Add client'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 5: Write `src/components/clients/new-client-button.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Fab } from '@/components/shell/fab'
import { ClientFormDialog } from './client-form-dialog'

export function NewClientButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Fab label="New client" onClick={() => setOpen(true)} />
      <ClientFormDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
```

- [ ] **Step 6: Replace `src/app/(app)/page.tsx`**

```tsx
import { Users } from 'lucide-react'
import { ClientCard } from '@/components/clients/client-card'
import { ClientSearch } from '@/components/clients/client-search'
import { NewClientButton } from '@/components/clients/new-client-button'
import { EmptyState } from '@/components/shell/empty-state'
import { PageHeader } from '@/components/shell/page-header'
import { requireCoachId } from '@/lib/session'
import { listClients } from '@/services/clients'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const coachId = await requireCoachId()
  const { q } = await searchParams
  const items = await listClients(coachId, q)

  return (
    <>
      <PageHeader title="Clients" />
      <div className="space-y-4 p-4 md:p-8">
        <ClientSearch />
        {items.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8 text-muted-foreground" />}
            title={q ? 'No clients match your search' : 'No clients yet'}
            description={q ? 'Try a different name or phone.' : 'Add your first client to get started.'}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((c) => (
              <ClientCard key={c.id} client={c} />
            ))}
          </div>
        )}
      </div>
      <NewClientButton />
    </>
  )
}
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run dev`
Expected: create a client via FAB → appears in list with "just now"; validation shows on empty name; search filters by name and phone (debounced); empty states render for no clients and no matches; layout is clean at phone width.

- [ ] **Step 8: Commit with trailer**

```bash
git add -A && git commit -m "feat: dashboard with client cards, search, and create dialog"
```

---

### Task 12: Client profile (details, edit/delete, plans list)

**Files:**
- Create: `src/services/plans.ts`, `src/components/clients/client-actions-menu.tsx`, `src/components/clients/plan-list.tsx`, `src/app/(app)/clients/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 10 (`getClient`, `deleteClientAction`, `updateClientAction`), Task 11 (`ClientFormDialog`, `formatDate`, `initials`)
- Produces:
  - `@/services/plans`: `type Plan`, `listPlansForClient(coachId: string, clientId: string): Promise<Plan[]>` (newest first, excludes soft-deleted). The plan-editor module will extend this file later.
  - `<PlanList plans />`, `<ClientActionsMenu client />` (client = `ClientFormClient` from Task 11)

- [ ] **Step 1: Write `src/services/plans.ts`**

```ts
import 'server-only'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/db/client'
import { plans } from '@/db/schema'

export type Plan = typeof plans.$inferSelect

export function listPlansForClient(coachId: string, clientId: string): Promise<Plan[]> {
  return db.query.plans.findMany({
    where: and(
      eq(plans.coachId, coachId),
      eq(plans.clientId, clientId),
      isNull(plans.deletedAt),
    ),
    orderBy: [desc(plans.createdAt)],
  })
}
```

- [ ] **Step 2: Write `src/components/clients/client-actions-menu.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteClientAction } from '@/actions/clients'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ClientFormDialog, type ClientFormClient } from './client-form-dialog'

export function ClientActionsMenu({ client }: { client: ClientFormClient }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function onDelete() {
    setDeleting(true)
    const result = await deleteClientAction(client.id)
    setDeleting(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success('Client deleted')
    router.push('/')
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Client actions">
            <MoreVertical className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="size-4" /> Edit details
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" /> Delete client
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={client} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {client.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The client and their plans will no longer appear in Planit.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={onDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 3: Write `src/components/clients/plan-list.tsx`** (server component)

```tsx
import { ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shell/empty-state'
import { formatDate } from '@/lib/format'
import type { Plan } from '@/services/plans'

const STATUS_STYLES: Record<Plan['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-brand/10 text-brand',
  completed: 'bg-secondary text-secondary-foreground',
}

export function PlanList({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="size-8 text-muted-foreground" />}
        title="No plans yet"
        description="Plan creation arrives with the plan editor module."
      />
    )
  }
  return (
    <div className="space-y-3">
      {plans.map((plan) => (
        <div key={plan.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div className="min-w-0">
            <p className="truncate font-semibold">{plan.title}</p>
            <p className="text-xs text-muted-foreground">
              Created {formatDate(plan.createdAt)} · Updated {formatDate(plan.updatedAt)}
            </p>
          </div>
          <Badge className={STATUS_STYLES[plan.status]}>{plan.status}</Badge>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Write `src/app/(app)/clients/[id]/page.tsx`**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ClientActionsMenu } from '@/components/clients/client-actions-menu'
import { PlanList } from '@/components/clients/plan-list'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/format'
import { requireCoachId } from '@/lib/session'
import { getClient } from '@/services/clients'
import { listPlansForClient } from '@/services/plans'

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const coachId = await requireCoachId()
  const { id } = await params
  const client = await getClient(coachId, id)
  if (!client) notFound()
  const clientPlans = await listPlansForClient(coachId, id)

  const facts = [
    client.age !== null ? `${client.age} yrs` : null,
    client.weightKg !== null ? `${client.weightKg} kg` : null,
    client.heightCm !== null ? `${client.heightCm} cm` : null,
    client.phone,
  ].filter((f): f is string => f !== null)

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-2 py-2 backdrop-blur md:px-6">
        <Link href="/" className="flex items-center gap-1 p-2 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> Clients
        </Link>
        <ClientActionsMenu client={client} />
      </header>
      <div className="space-y-6 p-4 md:p-8">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-brand/10 text-lg font-semibold text-brand">
              {initials(client.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{client.name}</h1>
            {facts.length > 0 && (
              <p className="text-sm text-muted-foreground">{facts.join(' · ')}</p>
            )}
          </div>
        </div>
        {client.notes && (
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{client.notes}</p>
        )}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Plans</h2>
          <PlanList plans={clientPlans} />
        </section>
      </div>
    </>
  )
}
```

- [ ] **Step 5: Verify**

Run: `npm run dev`
Expected: open a client from the dashboard → profile shows details; Edit updates and reflects immediately; Delete confirms, returns to dashboard, client gone from list; Plans section shows its empty state.

- [ ] **Step 6: Commit with trailer**

```bash
git add -A && git commit -m "feat: client profile with edit, delete, and plans list"
```

---

### Task 13: Exercises + tags services and actions

**Files:**
- Create: `src/services/exercises.ts`, `src/services/tags.ts`, `src/actions/exercises.ts`, `src/actions/tags.ts`
- Modify: `src/db/client.ts` (add `isUniqueViolation`)

**Interfaces:**
- Consumes: Tasks 3–5, Task 10 (`tryAction`)
- Produces:
  - `@/db/client`: `isUniqueViolation(e: unknown): boolean`
  - `@/services/tags`: `type Tag`, `listTags(coachId): Promise<Tag[]>`, `createTag(coachId, name): Promise<Tag>` (returns the existing tag when the name already exists)
  - `@/services/exercises`: `type Exercise`, `type ExerciseWithTags = Exercise & { tags: { id: string; name: string }[] }`, `type ExerciseUsage = { rowCount: number; planCount: number }`, `listExercises(coachId): Promise<ExerciseWithTags[]>`, `createExercise(coachId, input: ExerciseInput): Promise<Exercise>`, `updateExercise(coachId, exerciseId, input: ExerciseInput): Promise<Exercise | undefined>`, `getExerciseUsage(coachId, exerciseId): Promise<ExerciseUsage>`, `deleteExercise(coachId, exerciseId): Promise<boolean>`
  - `@/actions/exercises`: `createExerciseAction(input: unknown)` → `ActionResult<{ id: string }>`, `updateExerciseAction(exerciseId, input: unknown)` → `ActionResult<{ id: string }>`, `getExerciseUsageAction(exerciseId)` → `ActionResult<ExerciseUsage>`, `deleteExerciseAction(exerciseId)` → `ActionResult<null>`
  - `@/actions/tags`: `createTagAction(input: unknown)` → `ActionResult<{ id: string; name: string }>`

- [ ] **Step 1: Add `isUniqueViolation` to `src/db/client.ts`**

```ts
import postgres from 'postgres'

export function isUniqueViolation(e: unknown): boolean {
  return e instanceof postgres.PostgresError && e.code === '23505'
}
```

(`postgres` is already imported in this file — extend the existing import usage.)

- [ ] **Step 2: Write `src/services/tags.ts`**

```ts
import 'server-only'
import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { tags } from '@/db/schema'

export type Tag = typeof tags.$inferSelect

export function listTags(coachId: string): Promise<Tag[]> {
  return db.query.tags.findMany({ where: eq(tags.coachId, coachId), orderBy: [asc(tags.name)] })
}

export async function createTag(coachId: string, name: string): Promise<Tag> {
  const trimmed = name.trim()
  const [created] = await db
    .insert(tags)
    .values({ coachId, name: trimmed })
    .onConflictDoNothing()
    .returning()
  if (created) return created
  const existing = await db.query.tags.findFirst({
    where: and(eq(tags.coachId, coachId), sql`lower(${tags.name}) = lower(${trimmed})`),
  })
  if (!existing) throw new Error('Tag creation failed')
  return existing
}
```

- [ ] **Step 3: Write `src/services/exercises.ts`**

```ts
import 'server-only'
import { and, asc, count, countDistinct, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db/client'
import { exerciseTags, exercises, planRows, planSessions, plans, tags } from '@/db/schema'
import type { ExerciseInput } from '@/lib/validation'

export type Exercise = typeof exercises.$inferSelect
export type ExerciseWithTags = Exercise & { tags: { id: string; name: string }[] }
export type ExerciseUsage = { rowCount: number; planCount: number }

export async function listExercises(coachId: string): Promise<ExerciseWithTags[]> {
  const rows = await db
    .select()
    .from(exercises)
    .where(eq(exercises.coachId, coachId))
    .orderBy(asc(exercises.name))
  if (rows.length === 0) return []

  const links = await db
    .select({ exerciseId: exerciseTags.exerciseId, id: tags.id, name: tags.name })
    .from(exerciseTags)
    .innerJoin(tags, eq(exerciseTags.tagId, tags.id))
    .where(inArray(exerciseTags.exerciseId, rows.map((r) => r.id)))

  const byExercise = new Map<string, { id: string; name: string }[]>()
  for (const link of links) {
    const list = byExercise.get(link.exerciseId) ?? []
    list.push({ id: link.id, name: link.name })
    byExercise.set(link.exerciseId, list)
  }
  return rows.map((r) => ({ ...r, tags: byExercise.get(r.id) ?? [] }))
}

function toRow(input: ExerciseInput) {
  return {
    name: input.name,
    imageUrl: input.imageUrl ?? null,
    tutorialUrl: input.tutorialUrl ?? null,
  }
}

export async function createExercise(coachId: string, input: ExerciseInput): Promise<Exercise> {
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(exercises).values({ coachId, ...toRow(input) }).returning()
    if (!created) throw new Error('Insert returned no row')
    if (input.tagIds.length > 0) {
      await tx
        .insert(exerciseTags)
        .values(input.tagIds.map((tagId) => ({ exerciseId: created.id, tagId })))
        .onConflictDoNothing()
    }
    return created
  })
}

export async function updateExercise(
  coachId: string,
  exerciseId: string,
  input: ExerciseInput,
): Promise<Exercise | undefined> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(exercises)
      .set(toRow(input))
      .where(and(eq(exercises.id, exerciseId), eq(exercises.coachId, coachId)))
      .returning()
    if (!updated) return undefined
    await tx.delete(exerciseTags).where(eq(exerciseTags.exerciseId, exerciseId))
    if (input.tagIds.length > 0) {
      await tx
        .insert(exerciseTags)
        .values(input.tagIds.map((tagId) => ({ exerciseId, tagId })))
        .onConflictDoNothing()
    }
    return updated
  })
}

export async function getExerciseUsage(coachId: string, exerciseId: string): Promise<ExerciseUsage> {
  const [usage] = await db
    .select({ rowCount: count(planRows.id), planCount: countDistinct(plans.id) })
    .from(planRows)
    .innerJoin(planSessions, eq(planRows.sessionId, planSessions.id))
    .innerJoin(plans, eq(planSessions.planId, plans.id))
    .where(and(eq(planRows.exerciseId, exerciseId), eq(plans.coachId, coachId), isNull(plans.deletedAt)))
  return usage ?? { rowCount: 0, planCount: 0 }
}

/** HARD delete — FK cascade removes exercise_tags links AND plan_rows (spec sync rule). */
export async function deleteExercise(coachId: string, exerciseId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(exercises)
    .where(and(eq(exercises.id, exerciseId), eq(exercises.coachId, coachId)))
    .returning({ id: exercises.id })
  return deleted !== undefined
}
```

- [ ] **Step 4: Write `src/actions/exercises.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { isUniqueViolation } from '@/db/client'
import { err, fromZod, ok, tryAction, type ActionResult } from '@/lib/action-result'
import { requireCoachId } from '@/lib/session'
import { exerciseSchema } from '@/lib/validation'
import {
  createExercise, deleteExercise, getExerciseUsage, updateExercise,
  type ExerciseUsage,
} from '@/services/exercises'

export async function createExerciseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = exerciseSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    try {
      const exercise = await createExercise(coachId, parsed.data)
      revalidatePath('/library')
      return ok({ id: exercise.id })
    } catch (e) {
      if (isUniqueViolation(e)) return err('conflict', 'A move with this name already exists.')
      throw e
    }
  })
}

export async function updateExerciseAction(
  exerciseId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = exerciseSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    try {
      const updated = await updateExercise(coachId, exerciseId, parsed.data)
      if (!updated) return err('not_found', 'Move not found.')
      revalidatePath('/library')
      return ok({ id: updated.id })
    } catch (e) {
      if (isUniqueViolation(e)) return err('conflict', 'A move with this name already exists.')
      throw e
    }
  })
}

export async function getExerciseUsageAction(
  exerciseId: string,
): Promise<ActionResult<ExerciseUsage>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    return ok(await getExerciseUsage(coachId, exerciseId))
  })
}

export async function deleteExerciseAction(exerciseId: string): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const deleted = await deleteExercise(coachId, exerciseId)
    if (!deleted) return err('not_found', 'Move not found.')
    revalidatePath('/library')
    return ok(null)
  })
}
```

- [ ] **Step 5: Write `src/actions/tags.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { fromZod, ok, tryAction, type ActionResult } from '@/lib/action-result'
import { requireCoachId } from '@/lib/session'
import { tagSchema } from '@/lib/validation'
import { createTag } from '@/services/tags'

export async function createTagAction(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = tagSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const tag = await createTag(coachId, parsed.data.name)
    revalidatePath('/library')
    return ok({ id: tag.id, name: tag.name })
  })
}
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit with trailer**

```bash
git add -A && git commit -m "feat: exercises and tags services with usage-aware hard delete"
```

---

### Task 14: Library — Moves tab UI

**Files:**
- Create: `src/components/shared/image-upload-field.tsx`, `src/components/library/tag-multi-select.tsx`, `src/components/library/tag-filter.tsx`, `src/components/library/exercise-card.tsx`, `src/components/library/exercise-form-dialog.tsx`, `src/components/library/exercise-delete-dialog.tsx`, `src/components/library/library-moves-tab.tsx`, `src/app/(app)/library/page.tsx`

**Interfaces:**
- Consumes: Task 8 (`uploadImageAction`), Task 13 (all exercise/tag actions, `ExerciseWithTags`)
- Produces: `<ImageUploadField value onChange folder label? />` (reused by Task 16 for the logo), `<TagMultiSelect options value onChange onCreated />` with `type TagOption = { id: string; name: string }`, `<ExerciseFormDialog open onOpenChange exercise? tagOptions onCreated? />` (reused later by the plan editor's inline "Create & add"). Search and tag filtering are client-side (the library is small).

- [ ] **Step 1: Write `src/components/shared/image-upload-field.tsx`**

```tsx
'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { uploadImageAction } from '@/actions/uploads'
import { Button } from '@/components/ui/button'

// Plain <img>: Supabase Storage URLs would need next/image remotePatterns config — not worth it in MVP.

export function ImageUploadField({
  value,
  onChange,
  folder,
  label = 'Image',
}: {
  value: string | undefined
  onChange: (url: string | undefined) => void
  folder: 'exercises' | 'logos'
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function onFile(file: File) {
    setUploading(true)
    const formData = new FormData()
    formData.set('file', file)
    formData.set('folder', folder)
    const result = await uploadImageAction(formData)
    setUploading(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    onChange(result.data.url)
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-24 w-24 rounded-xl border object-cover" />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute -right-2 -top-2 rounded-full border bg-background p-1 shadow"
            aria-label="Remove image"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {uploading ? 'Uploading…' : `Upload ${label.toLowerCase()}`}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/library/tag-multi-select.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createTagAction } from '@/actions/tags'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type TagOption = { id: string; name: string }

export function TagMultiSelect({
  options,
  value,
  onChange,
  onCreated,
}: {
  options: TagOption[]
  value: string[]
  onChange: (ids: string[]) => void
  onCreated: (tag: TagOption) => void
}) {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  async function create() {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    const result = await createTagAction({ name })
    setCreating(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    onCreated(result.data)
    onChange([...value, result.data.id])
    setNewName('')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((tag) => (
          <button key={tag.id} type="button" onClick={() => toggle(tag.id)}>
            <Badge
              variant={value.includes(tag.id) ? 'default' : 'outline'}
              className={cn(value.includes(tag.id) && 'bg-brand text-brand-foreground')}
            >
              {tag.name}
            </Badge>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New tag…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void create()
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => void create()}
          disabled={creating || !newName.trim()}
          aria-label="Add tag"
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/components/library/tag-filter.tsx`**

```tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TagOption } from './tag-multi-select'

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
    <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
      <button type="button" onClick={() => onSelect(null)}>
        <Badge
          variant={selected === null ? 'default' : 'outline'}
          className={cn('whitespace-nowrap', selected === null && 'bg-brand text-brand-foreground')}
        >
          All
        </Badge>
      </button>
      {tags.map((tag) => (
        <button key={tag.id} type="button" onClick={() => onSelect(tag.id === selected ? null : tag.id)}>
          <Badge
            variant={selected === tag.id ? 'default' : 'outline'}
            className={cn('whitespace-nowrap', selected === tag.id && 'bg-brand text-brand-foreground')}
          >
            {tag.name}
          </Badge>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Write `src/components/library/exercise-card.tsx`**

```tsx
'use client'

import { Dumbbell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ExerciseWithTags } from '@/services/exercises'

export function ExerciseCard({
  exercise,
  onClick,
}: {
  exercise: ExerciseWithTags
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors hover:bg-accent/40"
    >
      {exercise.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={exercise.imageUrl} alt={exercise.name} className="size-12 rounded-xl border object-cover" />
      ) : (
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
          <Dumbbell className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{exercise.name}</p>
        {exercise.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {exercise.tags.map((t) => (
              <Badge key={t.id} variant="secondary" className="px-1.5 py-0 text-[10px]">
                {t.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}
```

- [ ] **Step 5: Write `src/components/library/exercise-delete-dialog.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { deleteExerciseAction, getExerciseUsageAction } from '@/actions/exercises'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { ExerciseUsage } from '@/services/exercises'

export function ExerciseDeleteDialog({
  open,
  onOpenChange,
  exercise,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercise: { id: string; name: string }
  onDeleted: () => void
}) {
  const [usage, setUsage] = useState<ExerciseUsage | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open) return
    setUsage(null)
    void getExerciseUsageAction(exercise.id).then((result) => {
      if (result.ok) setUsage(result.data)
      else toast.error(result.error.message)
    })
  }, [open, exercise.id])

  async function onDelete() {
    setDeleting(true)
    const result = await deleteExerciseAction(exercise.id)
    setDeleting(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success('Move deleted')
    onOpenChange(false)
    onDeleted()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {exercise.name}?</DialogTitle>
        </DialogHeader>
        {usage === null ? (
          <Skeleton className="h-10 w-full" />
        ) : usage.rowCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            This move is used in <strong>{usage.rowCount}</strong>{' '}
            {usage.rowCount === 1 ? 'row' : 'rows'} across <strong>{usage.planCount}</strong>{' '}
            {usage.planCount === 1 ? 'plan' : 'plans'}. Deleting it removes those rows from the
            plans <strong>permanently</strong>.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            This move is not used in any plan. Deleting it is permanent.
          </p>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onDelete} disabled={deleting || usage === null}>
            {deleting ? 'Deleting…' : 'Delete move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 6: Write `src/components/library/exercise-form-dialog.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { z } from 'zod'
import { createExerciseAction, updateExerciseAction } from '@/actions/exercises'
import { ImageUploadField } from '@/components/shared/image-upload-field'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { exerciseSchema } from '@/lib/validation'
import type { ExerciseWithTags } from '@/services/exercises'
import { ExerciseDeleteDialog } from './exercise-delete-dialog'
import { TagMultiSelect, type TagOption } from './tag-multi-select'

type FormValues = z.input<typeof exerciseSchema>

export function ExerciseFormDialog({
  open,
  onOpenChange,
  exercise,
  tagOptions,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercise?: ExerciseWithTags
  tagOptions: TagOption[]
  onCreated?: (id: string) => void
}) {
  const [localTags, setLocalTags] = useState<TagOption[]>(tagOptions)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { register, handleSubmit, reset, watch, setValue, setError, formState } =
    useForm<FormValues>({ resolver: zodResolver(exerciseSchema) })

  useEffect(() => {
    if (open) {
      setLocalTags(tagOptions)
      reset({
        name: exercise?.name ?? '',
        imageUrl: exercise?.imageUrl ?? '',
        tutorialUrl: exercise?.tutorialUrl ?? '',
        tagIds: exercise?.tags.map((t) => t.id) ?? [],
      })
    }
  }, [open, exercise, tagOptions, reset])

  const imageUrl = watch('imageUrl')
  const tagIds = watch('tagIds') ?? []

  const onSubmit = handleSubmit(async (values) => {
    const result = exercise
      ? await updateExerciseAction(exercise.id, values)
      : await createExerciseAction(values)
    if (!result.ok) {
      if (result.error.code === 'conflict') setError('name', { message: result.error.message })
      toast.error(result.error.message)
      return
    }
    toast.success(exercise ? 'Move updated' : 'Move added')
    onOpenChange(false)
    if (!exercise) onCreated?.(result.data.id)
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{exercise ? 'Edit move' : 'New move'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ex-name">Name</Label>
              <Input id="ex-name" {...register('name')} autoFocus={!exercise} />
              {formState.errors.name && (
                <p className="text-sm text-destructive">{formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Image</Label>
              <ImageUploadField
                value={typeof imageUrl === 'string' && imageUrl !== '' ? imageUrl : undefined}
                onChange={(url) => setValue('imageUrl', url ?? '')}
                folder="exercises"
              />
              <Input placeholder="…or paste an image URL" {...register('imageUrl')} />
              {formState.errors.imageUrl && (
                <p className="text-sm text-destructive">{formState.errors.imageUrl.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ex-tutorial">Tutorial link</Label>
              <Input id="ex-tutorial" inputMode="url" placeholder="https://…" {...register('tutorialUrl')} />
              {formState.errors.tutorialUrl && (
                <p className="text-sm text-destructive">{formState.errors.tutorialUrl.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <TagMultiSelect
                options={localTags}
                value={tagIds}
                onChange={(ids) => setValue('tagIds', ids)}
                onCreated={(tag) => setLocalTags((prev) => [...prev, tag])}
              />
            </div>
            <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? 'Saving…' : exercise ? 'Save changes' : 'Add move'}
            </Button>
            {exercise && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" /> Delete move
              </Button>
            )}
          </form>
        </DialogContent>
      </Dialog>
      {exercise && (
        <ExerciseDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          exercise={exercise}
          onDeleted={() => onOpenChange(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 7: Write `src/components/library/library-moves-tab.tsx`**

```tsx
'use client'

import { useMemo, useState } from 'react'
import { Dumbbell, Search } from 'lucide-react'
import { EmptyState } from '@/components/shell/empty-state'
import { Fab } from '@/components/shell/fab'
import { Input } from '@/components/ui/input'
import type { ExerciseWithTags } from '@/services/exercises'
import { ExerciseCard } from './exercise-card'
import { ExerciseFormDialog } from './exercise-form-dialog'
import { TagFilter } from './tag-filter'
import type { TagOption } from './tag-multi-select'

export function LibraryMovesTab({
  exercises,
  tags,
}: {
  exercises: ExerciseWithTags[]
  tags: TagOption[]
}) {
  const [search, setSearch] = useState('')
  const [tagId, setTagId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ExerciseWithTags | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return exercises.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false
      if (tagId && !e.tags.some((t) => t.id === tagId)) return false
      return true
    })
  }, [exercises, search, tagId])

  return (
    <div className="space-y-3 pt-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search moves…"
          className="pl-9"
          inputMode="search"
        />
      </div>
      <TagFilter tags={tags} selected={tagId} onSelect={setTagId} />
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="size-8 text-muted-foreground" />}
          title={exercises.length === 0 ? 'No moves yet' : 'No moves match'}
          description={exercises.length === 0 ? 'Add your first move.' : 'Try another search or tag.'}
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((exercise) => (
            <ExerciseCard key={exercise.id} exercise={exercise} onClick={() => setEditing(exercise)} />
          ))}
        </div>
      )}
      <Fab label="New move" onClick={() => setCreateOpen(true)} />
      <ExerciseFormDialog open={createOpen} onOpenChange={setCreateOpen} tagOptions={tags} />
      {editing && (
        <ExerciseFormDialog
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          exercise={editing}
          tagOptions={tags}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 8: Write `src/app/(app)/library/page.tsx`** (Moves tab only — Task 15 adds Warm-ups)

```tsx
import { LibraryMovesTab } from '@/components/library/library-moves-tab'
import { PageHeader } from '@/components/shell/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { requireCoachId } from '@/lib/session'
import { listExercises } from '@/services/exercises'
import { listTags } from '@/services/tags'

export default async function LibraryPage() {
  const coachId = await requireCoachId()
  const [exerciseList, tagList] = await Promise.all([listExercises(coachId), listTags(coachId)])

  return (
    <>
      <PageHeader title="Library" />
      <div className="p-4 md:p-8">
        <Tabs defaultValue="moves">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="moves">Moves</TabsTrigger>
            <TabsTrigger value="warmups">Warm-ups</TabsTrigger>
          </TabsList>
          <TabsContent value="moves">
            <LibraryMovesTab exercises={exerciseList} tags={tagList} />
          </TabsContent>
          <TabsContent value="warmups">
            <p className="pt-4 text-sm text-muted-foreground">Warm-ups arrive in the next task.</p>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
```

- [ ] **Step 9: Verify**

Run: `npm run dev` → `/library`
Expected: seeded moves listed alphabetically with tag chips; search and tag filter narrow the grid; create a move with an uploaded image (check it lands in the `planit-public` bucket and renders); edit it; rename to an existing name shows the conflict error on the name field; delete shows "not used in any plan" and removes it.

- [ ] **Step 10: Commit with trailer**

```bash
git add -A && git commit -m "feat: library moves tab with tags, image upload, and safe delete"
```

---

### Task 15: Library — Warm-ups tab

**Files:**
- Create: `src/services/warmups.ts`, `src/actions/warmups.ts`, `src/components/library/warmups-tab.tsx`
- Modify: `src/app/(app)/library/page.tsx` (wire the tab)

**Interfaces:**
- Consumes: Tasks 3–5, 10 (`tryAction`)
- Produces:
  - `@/services/warmups`: `type WarmupPreset`, `listWarmups(coachId): Promise<WarmupPreset[]>`, `createWarmup(coachId, text): Promise<WarmupPreset>`, `updateWarmup(coachId, id, text): Promise<WarmupPreset | undefined>`, `deleteWarmup(coachId, id): Promise<boolean>` — the plan editor's preset picker will consume `listWarmups` later.
  - `@/actions/warmups`: `createWarmupAction(input: unknown)`, `updateWarmupAction(id: string, input: unknown)`, `deleteWarmupAction(id: string)`

- [ ] **Step 1: Write `src/services/warmups.ts`**

```ts
import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { warmupPresets } from '@/db/schema'

export type WarmupPreset = typeof warmupPresets.$inferSelect

export function listWarmups(coachId: string): Promise<WarmupPreset[]> {
  return db.query.warmupPresets.findMany({
    where: eq(warmupPresets.coachId, coachId),
    orderBy: [asc(warmupPresets.text)],
  })
}

export async function createWarmup(coachId: string, text: string): Promise<WarmupPreset> {
  const [created] = await db
    .insert(warmupPresets)
    .values({ coachId, text: text.trim() })
    .returning()
  if (!created) throw new Error('Insert returned no row')
  return created
}

export async function updateWarmup(
  coachId: string,
  id: string,
  text: string,
): Promise<WarmupPreset | undefined> {
  const [updated] = await db
    .update(warmupPresets)
    .set({ text: text.trim() })
    .where(and(eq(warmupPresets.id, id), eq(warmupPresets.coachId, coachId)))
    .returning()
  return updated
}

export async function deleteWarmup(coachId: string, id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(warmupPresets)
    .where(and(eq(warmupPresets.id, id), eq(warmupPresets.coachId, coachId)))
    .returning({ id: warmupPresets.id })
  return deleted !== undefined
}
```

(Hard delete is safe here: presets are copied into plans as text, never referenced — spec §3.)

- [ ] **Step 2: Write `src/actions/warmups.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { err, fromZod, ok, tryAction, type ActionResult } from '@/lib/action-result'
import { requireCoachId } from '@/lib/session'
import { warmupSchema } from '@/lib/validation'
import { createWarmup, deleteWarmup, updateWarmup } from '@/services/warmups'

export async function createWarmupAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = warmupSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const warmup = await createWarmup(coachId, parsed.data.text)
    revalidatePath('/library')
    return ok({ id: warmup.id })
  })
}

export async function updateWarmupAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = warmupSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    const updated = await updateWarmup(coachId, id, parsed.data.text)
    if (!updated) return err('not_found', 'Warm-up not found.')
    revalidatePath('/library')
    return ok({ id: updated.id })
  })
}

export async function deleteWarmupAction(id: string): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const deleted = await deleteWarmup(coachId, id)
    if (!deleted) return err('not_found', 'Warm-up not found.')
    revalidatePath('/library')
    return ok(null)
  })
}
```

- [ ] **Step 3: Write `src/components/library/warmups-tab.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Check, Flame, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  createWarmupAction, deleteWarmupAction, updateWarmupAction,
} from '@/actions/warmups'
import { EmptyState } from '@/components/shell/empty-state'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { WarmupPreset } from '@/services/warmups'

export function WarmupsTab({ warmups }: { warmups: WarmupPreset[] }) {
  const [newText, setNewText] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [deleting, setDeleting] = useState<WarmupPreset | null>(null)

  async function create() {
    const text = newText.trim()
    if (!text) return
    setBusy(true)
    const result = await createWarmupAction({ text })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    setNewText('')
  }

  async function saveEdit(id: string) {
    setBusy(true)
    const result = await updateWarmupAction(id, { text: editText })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    setEditingId(null)
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    const result = await deleteWarmupAction(deleting.id)
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    setDeleting(null)
  }

  return (
    <div className="space-y-3 pt-3">
      <div className="flex gap-2">
        <Input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Add a warm-up line…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void create()
            }
          }}
        />
        <Button onClick={() => void create()} disabled={busy || !newText.trim()} size="icon" aria-label="Add warm-up">
          <Plus className="size-4" />
        </Button>
      </div>

      {warmups.length === 0 ? (
        <EmptyState
          icon={<Flame className="size-8 text-muted-foreground" />}
          title="No warm-ups yet"
          description="Saved warm-up lines can be reused in every plan."
        />
      ) : (
        <div className="space-y-2">
          {warmups.map((w) => (
            <div key={w.id} className="flex items-center gap-2 rounded-xl border bg-card p-3">
              {editingId === w.id ? (
                <>
                  <Input value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus />
                  <Button size="icon" variant="ghost" onClick={() => void saveEdit(w.id)} disabled={busy} aria-label="Save">
                    <Check className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} aria-label="Cancel">
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <p className="flex-1 text-sm">{w.text}</p>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(w.id)
                      setEditText(w.text)
                    }}
                    aria-label="Edit warm-up"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleting(w)} aria-label="Delete warm-up">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this warm-up?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{deleting?.text}" will be removed from your presets. Plans that already use it keep
            their text.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={busy}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 4: Wire into `src/app/(app)/library/page.tsx`**

Add imports and replace the placeholder `TabsContent`:

```tsx
import { WarmupsTab } from '@/components/library/warmups-tab'
import { listWarmups } from '@/services/warmups'
```

```tsx
const [exerciseList, tagList, warmupList] = await Promise.all([
  listExercises(coachId),
  listTags(coachId),
  listWarmups(coachId),
])
```

```tsx
<TabsContent value="warmups">
  <WarmupsTab warmups={warmupList} />
</TabsContent>
```

- [ ] **Step 5: Verify**

Run: `npm run dev` → `/library` → Warm-ups tab
Expected: seeded lines listed; add, edit inline, and delete (with confirm) all work and persist on reload.

- [ ] **Step 6: Commit with trailer**

```bash
git add -A && git commit -m "feat: warm-up presets tab with CRUD"
```

---

### Task 16: Settings (profile, branding, logout)

**Files:**
- Create: `src/actions/coaches.ts`, `src/components/settings/profile-form.tsx`, `src/app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: Task 6 (`getCoach`, `updateCoachProfile`, `logoutAction`), Task 13 (`isUniqueViolation`), Task 14 (`ImageUploadField`)
- Produces: `@/actions/coaches`: `updateProfileAction(input: unknown): Promise<ActionResult<null>>`

- [ ] **Step 1: Write `src/actions/coaches.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { isUniqueViolation } from '@/db/client'
import { err, fromZod, ok, tryAction, type ActionResult } from '@/lib/action-result'
import { requireCoachId } from '@/lib/session'
import { profileSchema } from '@/lib/validation'
import { updateCoachProfile } from '@/services/coaches'

export async function updateProfileAction(input: unknown): Promise<ActionResult<null>> {
  return tryAction(async () => {
    const coachId = await requireCoachId()
    const parsed = profileSchema.safeParse(input)
    if (!parsed.success) return fromZod(parsed.error)
    try {
      await updateCoachProfile(coachId, parsed.data)
    } catch (e) {
      if (isUniqueViolation(e)) return err('conflict', 'That email is already in use.')
      throw e
    }
    revalidatePath('/settings')
    return ok(null)
  })
}
```

- [ ] **Step 2: Write `src/components/settings/profile-form.tsx`**

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { z } from 'zod'
import { updateProfileAction } from '@/actions/coaches'
import { ImageUploadField } from '@/components/shared/image-upload-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { profileSchema } from '@/lib/validation'

type FormValues = z.input<typeof profileSchema>

export type CoachProfile = {
  name: string
  title: string | null
  phone: string | null
  email: string
  brandColor: string | null
  logoUrl: string | null
}

export function ProfileForm({ coach }: { coach: CoachProfile }) {
  const { register, handleSubmit, watch, setValue, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: coach.name,
      title: coach.title ?? '',
      phone: coach.phone ?? '',
      email: coach.email,
      brandColor: coach.brandColor ?? '#FE2E00',
      logoUrl: coach.logoUrl ?? '',
    },
  })

  const logoUrl = watch('logoUrl')
  const brandColor = watch('brandColor')

  const onSubmit = handleSubmit(async (values) => {
    const result = await updateProfileAction(values)
    if (!result.ok) {
      if (result.error.code === 'conflict') setError('email', { message: result.error.message })
      toast.error(result.error.message)
      return
    }
    toast.success('Profile saved')
  })

  const fieldError = (name: keyof FormValues) => formState.errors[name]?.message

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Logo</Label>
        <ImageUploadField
          value={typeof logoUrl === 'string' && logoUrl !== '' ? logoUrl : undefined}
          onChange={(url) => setValue('logoUrl', url ?? '')}
          folder="logos"
          label="Logo"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-name">Name</Label>
        <Input id="p-name" {...register('name')} />
        {fieldError('name') && <p className="text-sm text-destructive">{fieldError('name')}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-title">Title</Label>
        <Input id="p-title" placeholder="Certified PT & Fitness Nutritionist" {...register('title')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-phone">Phone</Label>
        <Input id="p-phone" type="tel" inputMode="tel" {...register('phone')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-email">Email</Label>
        <Input id="p-email" type="email" {...register('email')} />
        {fieldError('email') && <p className="text-sm text-destructive">{fieldError('email')}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-color">Brand color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={typeof brandColor === 'string' && brandColor ? brandColor : '#FE2E00'}
            onChange={(e) => setValue('brandColor', e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border bg-background"
            aria-label="Pick brand color"
          />
          <Input id="p-color" className="max-w-32" {...register('brandColor')} />
        </div>
        {fieldError('brandColor') && (
          <p className="text-sm text-destructive">{fieldError('brandColor')}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Write `src/app/(app)/settings/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { logoutAction } from '@/actions/auth'
import { ProfileForm } from '@/components/settings/profile-form'
import { PageHeader } from '@/components/shell/page-header'
import { Button } from '@/components/ui/button'
import { requireCoachId } from '@/lib/session'
import { getCoach } from '@/services/coaches'

export default async function SettingsPage() {
  const coachId = await requireCoachId()
  const coach = await getCoach(coachId)
  if (!coach) redirect('/login')

  return (
    <>
      <PageHeader title="Settings" />
      <div className="max-w-lg space-y-8 p-4 md:p-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Profile & branding</h2>
          <p className="text-sm text-muted-foreground">
            Shown on your clients' plans, share links, and PDFs.
          </p>
          <ProfileForm
            coach={{
              name: coach.name,
              title: coach.title,
              phone: coach.phone,
              email: coach.email,
              brandColor: coach.brandColor,
              logoUrl: coach.logoUrl,
            }}
          />
        </section>
        <form action={logoutAction}>
          <Button variant="outline" className="w-full" type="submit">
            Log out
          </Button>
        </form>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Verify**

Run: `npm run dev` → `/settings`
Expected: seeded profile loads; upload a logo, change title/phone/brand color, save → toast, values persist on reload; changing email to the other coach's email shows the conflict error; Log out returns to `/login` and protected routes redirect until you log in again.

- [ ] **Step 5: Commit with trailer**

```bash
git add -A && git commit -m "feat: settings with coach profile, branding, and logout"
```

---

### Task 17: CI, keep-alive, README

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/keepalive.yml`, `README.md`

**Interfaces:**
- Consumes: all previous tasks (CI runs their checks)
- Produces: green CI on push; twice-weekly DB ping (Supabase free tier pauses after ~1 week idle); README covering setup, env, seed, deploy, and manual password reset.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push:
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
        env:
          # Build never opens a DB connection (all data routes are dynamic;
          # postgres-js connects lazily) — placeholders satisfy module init.
          DATABASE_URL: postgresql://placeholder:placeholder@localhost:5432/placeholder
          JWT_SECRET: ci-placeholder-secret-at-least-32-chars
          SUPABASE_URL: https://placeholder.supabase.co
          SUPABASE_SERVICE_ROLE_KEY: placeholder
```

- [ ] **Step 2: Write `.github/workflows/keepalive.yml`**

```yaml
name: DB keep-alive
on:
  schedule:
    - cron: '0 8 * * 1,4' # Mon + Thu 08:00 UTC
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: psql "$DATABASE_URL" -c "select 1"
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

Then add the repo secret: GitHub → Settings → Secrets and variables → Actions → new secret `DATABASE_URL` (same value as `.env.local`).

- [ ] **Step 3: Write `README.md`**

```markdown
# Planit

Workout plan management for coaches. Next.js 15 + Supabase (Postgres/Storage) +
Drizzle. Mobile-first.

## Setup

1. `npm install`
2. Create a free Supabase project; create a **public** Storage bucket named
   `planit-public`.
3. Copy `.env.example` to `.env.local` and fill it (see below).
4. `npm run db:migrate` — applies migrations.
5. `npm run db:seed` — creates the two coach accounts (idempotent).
6. `npm run dev`

## Environment variables

| Var | What |
| --- | --- |
| `DATABASE_URL` | Supabase **transaction pooler** URL (port 6543) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only, never exposed) |
| `JWT_SECRET` | Random string, 32+ chars |
| `SEED_COACH1_EMAIL/_PASSWORD/_NAME` | First coach account (seed-time only) |
| `SEED_COACH2_EMAIL/_PASSWORD/_NAME` | Second coach account (seed-time only) |

## Deploy (Vercel)

1. Push to GitHub, import the repo in Vercel.
2. Add `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`
   as Vercel env vars (seed vars not needed in prod — seed runs locally).
3. Deploy. Add the `DATABASE_URL` GitHub Actions secret for the keep-alive job.

## Password reset (manual, MVP)

Generate a hash, then update the row in Supabase:

    node -e "require('bcryptjs').hash('NEW_PASSWORD', 12).then(console.log)"
    -- SQL editor: update coaches set password_hash = '<hash>' where email = '<email>';
```

Also create `.env.example` with every variable name and empty values.

- [ ] **Step 4: Verify**

Push the branch; confirm the CI workflow passes on GitHub. Run the keep-alive workflow once via "Run workflow" and confirm it succeeds.

- [ ] **Step 5: Commit with trailer**

```bash
git add -A && git commit -m "chore: CI, DB keep-alive workflow, and README"
```

---

## Post-plan follow-ups (not in this plan)

- Plan editor module (design pass → its own plan): plan CRUD/duplication actions, session/row editing, autosave (10s debounce + flush), preset picker, inline move creation (reuses `ExerciseFormDialog`), status/share controls.
- Share view + print/PDF module (design pass → its own plan).
- Brand/visual re-skin pass using the user's design reference (tokens are the seam).
