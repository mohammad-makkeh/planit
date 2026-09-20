# Product Specification & Questions

## Recommended Stack (React + Free, TS Everywhere)

* **Next.js 15 (App Router) on Vercel Free Tier** — Your React frontend and TypeScript backend (route handlers + server actions) in one project, one deploy, zero cost. Beats a separate Node/Bun API for an MVP: no CORS, no second deployment, end-to-end types for free.
* **Supabase (Free Tier)** — Postgres + Auth + Storage. DB for everything, Auth for the no-signup login (one pre-created coach user; session persists = your "logged in forever"), Storage for exercise images.
* **Drizzle ORM** — For schema, migrations, and queries; pairs perfectly with Supabase's connection pooler.
* **Tailwind CSS + shadcn/ui** — For the UI layer. Fully themeable to a brand, accessible primitives, the current best foundation for "immaculate UX" without a design team.
* **Zod + react-hook-form** — For validation/forms, with TanStack Query where client-side data flow needs it.
* **PDF Export** — A print-optimized route + the browser's print dialog (Chrome's print engine). Zero infra, pixel-identical, works on phones. Server-side PDF generation can be added later if "email the file" automation is needed.
* **Vitest + Testing Library + Playwright** — For tests.
* **PWA Manifest** — So the coach installs it like an app on their phone.

---

## Questions & Architectural Options

### A. Product & Users

1. **Client fields** — Beyond name: phone? email? age/DOB? goals? injuries/medical notes? starting weight/measurements?  
   *Recommendation:* Name (required), phone, email, free-text notes; skip measurements/tracking for MVP — that's a whole module.
2. **Client Interaction** — Do clients ever log in or interact, or is the share link strictly view-only for MVP?  
   *Recommendation:* View-only; interactivity is a v2 module.
3. **Multi-coach readiness** — MVP is one coach, but should the data model carry `coach_id` on everything from day 1 so selling it later is a migration-free step?  
   *Recommendation:* Yes — costs nothing now, saves a painful migration later.
4. **Language** — English only for MVP? Any Arabic/RTL ambitions worth keeping the door open for?
5. **Units** — kg only, or kg/lbs setting per coach/client?

---

### B. Plan Structure (The Heart of It)

6. **Session Labeling** — Is a plan always "named weekdays" (Monday–Friday), or should it be an ordered list of sessions with free labels ("Day 1", "Push A")?  
   *Recommendation:* Ordered sessions with a free label + optional weekday — strictly more flexible, same UI.
7. **Columns per exercise row** — Are sets / reps / speed(tempo) / 1RM% / rest the fixed set, plus an optional note per row? Or do you want custom columns per plan?  
   *Recommendation:* Fixed columns + per-row note; custom columns explode complexity for little gain.
8. **Field types** — Reps can be "1MIN", 1RM can be "75% 85%", speed can be "NEGATIVE CONTROL". Confirm all row fields are free-form strings with smart input helpers, not strictly numbers.
9. **Warm-up block** — Free-text lines + one optional highlighted instruction line, or fully structured rows like the main table?  
   *Recommendation:* Free-text lines — coaches write warm-ups loosely.
10. **Cardio block** — Keep as Time + Heart rate/incline per session? Optional per session?
11. **Supersets** — Do you need rows visually/logically linked as a superset, or is writing it in the exercise name/note (like "superset narrow stance") enough for MVP?
12. **Plan status lifecycle** — Draft → Active → Archived? Can a client have multiple active plans at once, or exactly one?  
    *Recommendation:* Statuses yes; allow multiple active (enforcing one adds friction).
13. **Versioning semantics** — Every "Save" creates a history checkpoint (list of dated versions, view any read-only, "restore" = copy into a new editable version)? Or do you want field-level change tracking ("changed sets from 3 to 4")?  
    *Recommendation:* Snapshot-per-save — simple, robust, and matches "track history + see dates". Field-level diffs are v2 polish.
14. **Duplication scope** — Duplicate a plan (a) into the same client, (b) into another client, (c) into a reusable "template" pool not attached to anyone?  
    *Recommendation:* All three — templates are just plans with no client, and coaches will love them.
15. **Per-day extras** — Keep the "session focus / reminder" chip as an optional per-session note? Also: want a coach-private note per plan that never appears in PDF/share view?

---

### C. Exercise Library ("Moves")

16. **Seeding** — Seeding the library with ~40 exercises from the current plan + standard gym movements. What categorization do you want: muscle group (chest/back/legs…), movement type (push/pull/legs/core), or both?  
    *Recommendation:* One category field with coach-editable values.
17. **Images** — Upload from phone (Supabase Storage) and/or paste an image URL?  
    *Recommendation:* Both; upload is the main path.
18. **Tutorial link** — One optional URL per exercise (video, PDF, anything). Confirm — or do you want multiple links per exercise?
19. **Library edits vs. old plans** — If the coach renames/deletes a library exercise, should already-created plans keep what they said at the time?  
    *Recommendation:* Plan rows store a reference + a snapshot of the name — old plans are documents and must never silently change. Deleting a library exercise never touches existing plans.
20. **Inline creation** — While building a plan, typing an exercise that doesn't exist offers "create & add to library" without leaving the flow. Confirm? And is free-text without adding to library also allowed?

---

### D. Share Link & PDF

21. **Live or frozen** — Does the client's share link always show the plan's latest saved version, or a snapshot frozen at share time?  
    *Recommendation:* Live latest — coach fixes a typo, client sees it fixed instantly.
22. **Link control** — Unguessable URL slug, with a "revoke / regenerate link" action. No expiry dates. Is this enough?
23. **PDF/Share branding** — Coach name, subtitle, phone, logo, and brand color come from a coach profile/settings screen. Confirm — and should the app's own UI use this same brand, or stay a neutral product look?  
    *Recommendation:* Neutral-dark product UI with the brand color as an accent; coach branding applies to PDF + share view.
24. **Share view shape** — Same document layout as the PDF, or an app-like mobile view (day tabs, tap an exercise to open its tutorial link)?  
    *Recommendation:* App-like — it's the main benefit of sending a link over a PDF.

---

### E. Auth & Platform

25. **Login** — Supabase Auth with one manually-created email+password user, no signup UI, persistent session (`localStorage` equivalent). OK, or do you prefer a simpler env-var password?  
    *Recommendation:* Supabase Auth — same effort, real security posture, and scaling to multiple coaches later is trivial.
26. **PWA** — Installable on the coach's home screen with the logo as the icon?  
    *Recommendation:* Yes.
27. **Offline** — Full offline editing is a major complexity jump.  
    *Recommendation:* Online-required with optimistic UI and graceful retry for MVP.
28. **Domain** — `*.vercel.app` fine for now, or do you already own a custom domain?

---

### F. Project & Quality

29. **Repo** — Fresh git repo. Does this folder become it (moving `plan.html`/`data.json` into a `/reference` folder), or a new folder/repo entirely?
30. **Testing bar** — Unit tests on business logic (versioning, duplication) + Playwright e2e on the 3 critical flows (create client → build plan → share/export)? Or heavier?
31. **CI** — GitHub Actions running typecheck/lint/tests on push?  
    *Recommendation:* Yes, it's free.
32. **Product name** — Name required for repo, PWA name, and login screen. Have one in mind, or shall options be proposed?

---

### G. Recommendations to Accept/Reject

33. **Soft Delete Everywhere** — Archive clients/plans, nothing hard-deleted from the UI; real delete = a buried "danger" action.
34. **Dashboard** — Client list sorted by recently-edited, with global fuzzy search across clients and plan titles.
35. **"Duplicate Day"** — Duplicate a day inside the plan editor (copy Monday's structure to Thursday and tweak).
36. **Undo-Toast Pattern** — "Plan archived — Undo" instead of confirmation modals for reversible actions; modals only for destructive ones.
37. **Autosave Drafts** — Autosave while editing (never lose work on a phone), with explicit "Save version" being the history checkpoint from #13.