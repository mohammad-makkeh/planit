# Planit

Workout plan management for coaches. Next.js 16 + Supabase (Postgres/Storage) +
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
3. Deploy. Add the `DATABASE_URL` GitHub Actions secret for the keep-alive job:
   GitHub → Settings → Secrets and variables → Actions → new secret `DATABASE_URL`
   (same value as your local `.env.local`).

## Password reset (manual, MVP)

Generate a hash, then update the row in Supabase:

    node -e "require('bcryptjs').hash('NEW_PASSWORD', 12).then(console.log)"
    -- SQL editor: update coaches set password_hash = '<hash>' where email = '<email>';
