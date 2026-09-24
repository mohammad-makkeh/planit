# Gym Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Start" pill on the share page opens a full-screen, dark, branded workout player: one move at a time, tappable set circles, an automatic rest countdown with chime and buzz, wake lock, same-day progress kept on the phone, and a finish screen that hands off to the story cards.

**Architecture:** All state rules are pure functions in `src/lib/gym-mode.ts` (reducer, storage key, formatting, summary). The player is a Base UI `Dialog` rendered inside the app's existing `dark` token scope, composed of small components under `src/components/share/gym-mode/`; the open state is the `?play=<day>` search param, pushed with the history API so the back button closes the player. Device APIs (Web Audio chime, vibration, wake lock, a rAF rest clock) live in small hooks/modules beside it. No server, schema or migration changes.

**Tech Stack:** Next.js 16 App Router (client components, `useSearchParams` + `window.history.pushState` integration), React 19 (`useReducer`, `useSyncExternalStore`), Tailwind v4 + shadcn on Base UI, lucide-react, existing `MuscleMap` / `MoveThumbnail` / `DialogSheet` / `StorySheet`.

**Spec:** `docs/superpowers/specs/2026-09-24-planit-gym-mode-design.md`

## Global Constraints

- **No automated tests** (standing decision, `AGENTS.md` §1). Verification per task is `npx tsc --noEmit`, `npx eslint src` (0 errors; the two known `react-hooks/incompatible-library` warnings are accepted) and, for UI, a real browser at **390×844** and a desktop width. Pure logic is checked with a throwaway `npx tsx` script that is **deleted** afterwards, never committed.
- **Never push.** Commit locally per task; the push is the deploy and waits for the owner's explicit go-ahead. No migrations here anyway.
- **Dev and production share one database.** Only touch the owner's test fixture: share page `/p/ljFXxhEJ_1TM` (client Ali Abbas Berro, coach "Mohammad Makkeh"). The share page is public, so no cookie is needed.
- **Base UI rules:** `render` prop, never `asChild`. Anything that opens *over* the player (a Base UI dialog) is a `DialogSheet`, never a vaul sheet.
- **Lint rules in force (eslint-plugin-react-hooks 7.1.1):** no `setState`/`dispatch` called synchronously in an effect body (`set-state-in-effect`), no `ref.current =` during render (`refs`), no `Date.now()` / `Math.random()` / `performance.now()` during render (`purity`). Read `Date.now()` in event handlers, rAF callbacks and effects only; pass `now` into reducer actions.
- **Copy:** sentence case ("Start", "Finish workout", "Workout done"). Tap targets ≥ 40px. Safe-area insets. No horizontal overflow at 390.
- **Dark scope:** the player's popup carries `className="dark"` plus inline `--brand`, `--background: #0f0f0f`, `--card: rgba(255,255,255,0.06)`. Everything portalled out of it (`DialogSheet`s) must receive the same `className` and `style`.
- **Dev server:** running on `http://localhost:3000`. Running `next build` while it runs corrupts its cache — restart the dev server after any build.
- Commit message format: conventional prefix, short why-body, blank line, then `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. **Rest ends while the tab is hidden** (client switched to a music app for two minutes): on return the countdown must not show a negative or stale value; the end fires once, the buzz/chime fire once, and the auto-advance runs once. Pinned in Task 3 (`useRestClock` visibility handling) and Task 8 browser check.
2. **Saved progress from an older plan version** (coach saved the plan after the client started): `deserialize` must reject a mismatch in row count or set count and start fresh rather than crash or mis-tick. Pinned in Task 1 script.
3. **A day where every row has null sets and null rest** (the test fixture's "Legs Day"): each row gets one circle, ticking it advances after ~400 ms with no timer, and the finish summary reads `2 moves · 2 sets` with no minutes-from-nothing nonsense. Pinned in Task 1 script and Task 8.
4. **Landing on `/p/<slug>?play=9`** (bad or stale index) or `?play=abc`: the player must not open, the param is stripped without adding a history entry, and the page renders normally. Pinned in Task 3 (`usePlayParam`) and Task 8.
5. **Storage unavailable** (Safari private mode, blocked site data): every read/write is wrapped; the player works for the session, the Start pill just says `Start`. Pinned in Task 1 (storage helpers) — verified by reading the code, since it can't be reproduced in emulation.

---

### Task 1: Pure state and storage helpers (`src/lib/gym-mode.ts`)

**Files:**
- Create: `src/lib/gym-mode.ts`
- Modify: `docs/superpowers/specs/2026-09-24-planit-gym-mode-design.md` (one wording fix: minutes are measured from the first ticked set, not from tapping Start — `Date.now()` during render is forbidden by lint, so Start-tap time is not recorded)

**Interfaces:**
- Consumes: `localDateParam()` from `src/lib/story.ts` (already exists: the phone's local `YYYY-MM-DD`).
- Produces (exact names later tasks import):
  - types `GymRow`, `GymRest`, `GymState`, `GymAction`, `GymSummary`
  - `setCount(row)`, `restMs(row)`, `initialState(rows)`, `reduce(state, action, rows)`, `setsDone(state, move)`, `moveComplete(state, move)`, `advancesWithoutRest(state, move, rows)`, `progressLabel(state, separator?)`, `formatCountdown(ms)`, `formatPrescription(row)`, `plural(n, word)`, `summary(state)`, `formatSummary(summary)`
  - `STORAGE_PREFIX`, `MUTED_KEY`, `PROGRESS_EVENT`, `storageKey(slug, day, date, planUpdatedAt)`, `todayKey(slug, day, planUpdatedAt)`, `todayDate()`, `serialize(state)`, `deserialize(raw, rows)`, `readProgress(key, rows)`, `writeProgress(key, state)`, `removeProgress(key)`, `purgeStaleProgress(slug, date)`, `readMuted()`, `writeMuted(muted)`, `subscribeProgress(callback)`

- [ ] **Step 1: Fix the spec wording**

In `docs/superpowers/specs/2026-09-24-planit-gym-mode-design.md`, in the *Finish screen* section, replace

```
sets, minutes since Start was tapped, rounded)
```

with

```
sets, minutes from the first ticked set to the finish, rounded, at least 1 when anything was ticked)
```

and in the *State model* section replace the `startedAt` line with:

```ts
  startedAt: number | null     // epoch ms of the first ticked set (for the finish summary)
  finishedAt: number | null    // epoch ms when the finish screen was reached
```

- [ ] **Step 2: Write `src/lib/gym-mode.ts`**

```ts
import { localDateParam } from './story'

/**
 * Gym Mode's rules as pure functions, so the player component stays thin and the behaviour can
 * be checked from a script. Only the storage helpers at the bottom touch the browser, and they
 * wrap `localStorage` because private browsing makes it throw.
 */

/** The parts of a plan row the state machine needs. `SharedRow` satisfies it structurally. */
export type GymRow = { sets: number | null; rest: number | null }

export type GymRest = { move: number; set: number; endsAt: number }

export type GymState = {
  /** Epoch ms of the first ticked set; null until then. Drives the finish summary's minutes. */
  startedAt: number | null
  /** Epoch ms when the finish screen was reached; null before. */
  finishedAt: number | null
  /** Index of the move on screen. */
  move: number
  /** ticks[move][set] — a row with no sets has a single "Done" entry. */
  ticks: boolean[][]
  rest: GymRest | null
  finished: boolean
}

/** Every time-dependent action carries `now`: the reducer never reads the clock itself. */
export type GymAction =
  | { type: 'toggle-set'; move: number; set: number; now: number }
  | { type: 'skip-rest'; now: number }
  | { type: 'rest-ended'; now: number }
  | { type: 'advance'; now: number }
  | { type: 'go-to'; move: number }
  | { type: 'finish'; now: number }

/** How many circles a row gets: its sets, or one "Done" circle when the coach set none. */
export function setCount(row: GymRow): number {
  return row.sets !== null && row.sets > 0 ? row.sets : 1
}

/** A row's rest in ms; 0 when it has none (null and 0 both mean "no timer"). */
export function restMs(row: GymRow): number {
  return row.rest !== null && row.rest > 0 ? row.rest * 1000 : 0
}

export function initialState(rows: GymRow[]): GymState {
  return {
    startedAt: null,
    finishedAt: null,
    move: 0,
    ticks: rows.map((row) => Array.from({ length: setCount(row) }, () => false)),
    rest: null,
    finished: false,
  }
}

export function setsDone(state: GymState, move: number): number {
  return (state.ticks[move] ?? []).filter(Boolean).length
}

export function moveComplete(state: GymState, move: number): boolean {
  const ticks = state.ticks[move]
  return ticks !== undefined && ticks.length > 0 && ticks.every(Boolean)
}

/** Leaves the move on screen for the next one, or reaches the finish screen after the last. */
function advance(state: GymState, now: number): GymState {
  if (state.move + 1 < state.ticks.length) return { ...state, move: state.move + 1, rest: null }
  return { ...state, finished: true, finishedAt: state.finishedAt ?? now, rest: null }
}

/**
 * Ends the running rest. When it belonged to the move on screen and that move is now complete,
 * the player moves on by itself; a rest started on another move (the client jumped ahead
 * mid-rest) just ends.
 */
function endRest(state: GymState, now: number): GymState {
  if (!state.rest) return state
  const owner = state.rest.move
  const next: GymState = { ...state, rest: null }
  return owner === state.move && moveComplete(next, owner) ? advance(next, now) : next
}

export function reduce(state: GymState, action: GymAction, rows: GymRow[]): GymState {
  switch (action.type) {
    case 'toggle-set': {
      const row = rows[action.move]
      const ticks = state.ticks[action.move]
      if (!row || !ticks || action.set < 0 || action.set >= ticks.length) return state
      const done = !ticks[action.set]
      const nextTicks = state.ticks.map((t, i) =>
        i === action.move ? t.map((v, j) => (j === action.set ? done : v)) : t,
      )
      if (!done) {
        // Un-ticking the set whose rest is running cancels that rest; any other rest keeps going.
        const cancels = state.rest?.move === action.move && state.rest.set === action.set
        return { ...state, ticks: nextTicks, rest: cancels ? null : state.rest }
      }
      const ms = restMs(row)
      return {
        ...state,
        startedAt: state.startedAt ?? action.now,
        ticks: nextTicks,
        // A new tick on a row with rest replaces whatever rest was running.
        rest: ms > 0 ? { move: action.move, set: action.set, endsAt: action.now + ms } : state.rest,
      }
    }
    case 'skip-rest':
    case 'rest-ended':
      return endRest(state, action.now)
    case 'advance':
      return advance(state, action.now)
    case 'go-to':
      if (action.move < 0 || action.move >= state.ticks.length) return state
      return { ...state, move: action.move }
    case 'finish':
      return { ...state, finished: true, finishedAt: state.finishedAt ?? action.now, rest: null }
  }
}

/**
 * After a tick: does the move on screen move on without a timer? True when the row has no rest
 * and every set is now done — the component waits for the tick animation, then dispatches
 * `advance`.
 */
export function advancesWithoutRest(state: GymState, move: number, rows: GymRow[]): boolean {
  const row = rows[move]
  return row !== undefined && restMs(row) === 0 && move === state.move && moveComplete(state, move)
}

/** "1 / 4" in the player's top bar, "2 of 4" on the Continue pill. */
export function progressLabel(state: GymState, separator: 'of' | '/' = 'of'): string {
  return `${state.move + 1} ${separator} ${state.ticks.length}`
}

/** Remaining ms → "1:30", "0:07". Rounds up, so the display never reads 0:00 while time is left. */
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

type Prescription = {
  sets: number | null
  reps: number | null
  rest: number | null
  oneRm: number | null
  speed: string | null
}

/**
 * The move screen's numbers: a big "4 × 10" (or "4 sets" / "10 reps" when one side is missing,
 * null when both are) and a muted detail line "90 s rest · 75% 1RM · 2/1/1" of whatever exists.
 * A rest of 0 is not worth a word.
 */
export function formatPrescription(row: Prescription): { big: string | null; details: string } {
  const big =
    row.sets !== null && row.reps !== null
      ? `${row.sets} × ${row.reps}`
      : row.sets !== null
        ? plural(row.sets, 'set')
        : row.reps !== null
          ? plural(row.reps, 'rep')
          : null
  const speed = row.speed?.trim() ?? ''
  const details = [
    row.rest !== null && row.rest > 0 ? `${row.rest} s rest` : null,
    row.oneRm !== null ? `${row.oneRm}% 1RM` : null,
    speed || null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')
  return { big, details }
}

export type GymSummary = { moves: number; sets: number; minutes: number }

/** Moves in the day, sets actually ticked, minutes from the first tick to the finish (0 if none). */
export function summary(state: GymState): GymSummary {
  const sets = state.ticks.reduce((sum, t) => sum + t.filter(Boolean).length, 0)
  const span =
    state.startedAt !== null && state.finishedAt !== null ? state.finishedAt - state.startedAt : 0
  return {
    moves: state.ticks.length,
    sets,
    minutes: span > 0 ? Math.max(1, Math.round(span / 60_000)) : 0,
  }
}

/** "4 moves · 13 sets · 48 min" — minutes are left out when nothing was ticked. */
export function formatSummary({ moves, sets, minutes }: GymSummary): string {
  const parts = [plural(moves, 'move'), plural(sets, 'set')]
  if (minutes > 0) parts.push(`${minutes} min`)
  return parts.join(' · ')
}

// ---- Memory on the phone ----------------------------------------------------------------------

export const STORAGE_PREFIX = 'planit:gym:'
export const MUTED_KEY = 'planit:gym:muted'
/** Fired on `window` whenever progress is written or cleared, so the Start pill can re-read it. */
export const PROGRESS_EVENT = 'planit:gym-progress'

/**
 * One key per plan, day and local date. The plan's save time is part of it so a coach's edit
 * mid-workout starts fresh instead of pointing ticks at the wrong rows.
 */
export function storageKey(slug: string, day: number, date: string, planUpdatedAt: number): string {
  return `${STORAGE_PREFIX}${slug}:${day}:${date}:${planUpdatedAt}`
}

/** The phone's local date — "today" is the client's, not the server's. */
export function todayDate(): string {
  return localDateParam()
}

export function todayKey(slug: string, day: number, planUpdatedAt: number): string {
  return storageKey(slug, day, todayDate(), planUpdatedAt)
}

export function serialize(state: GymState): string {
  return JSON.stringify(state)
}

/**
 * Parses a saved state and checks its shape against the rows it will drive. Anything off — a
 * different number of moves or sets, a bad field — returns null and the player starts fresh.
 */
export function deserialize(raw: string | null, rows: GymRow[]): GymState | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const v = value as Record<string, unknown>
    const ticks = v.ticks
    if (!Array.isArray(ticks) || ticks.length !== rows.length) return null
    const ticksOk = ticks.every(
      (t, i) =>
        Array.isArray(t) &&
        t.length === setCount(rows[i]!) &&
        t.every((x) => typeof x === 'boolean'),
    )
    if (!ticksOk) return null
    const move = v.move
    if (typeof move !== 'number' || !Number.isInteger(move) || move < 0 || move >= rows.length) return null
    const rest = v.rest
    const restOk =
      rest === null ||
      (typeof rest === 'object' &&
        rest !== null &&
        (['move', 'set', 'endsAt'] as const).every(
          (k) => typeof (rest as Record<string, unknown>)[k] === 'number',
        ))
    if (!restOk) return null
    const nullableNumber = (x: unknown): x is number | null => x === null || typeof x === 'number'
    if (!nullableNumber(v.startedAt) || !nullableNumber(v.finishedAt) || typeof v.finished !== 'boolean') {
      return null
    }
    return {
      startedAt: v.startedAt,
      finishedAt: v.finishedAt,
      move,
      ticks: ticks as boolean[][],
      rest: rest as GymRest | null,
      finished: v.finished,
    }
  } catch {
    return null
  }
}

/** `localStorage`, or null where reading it throws (private mode, blocked site data). */
function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function notify(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PROGRESS_EVENT))
}

export function readProgress(key: string, rows: GymRow[]): GymState | null {
  try {
    return deserialize(storage()?.getItem(key) ?? null, rows)
  } catch {
    return null
  }
}

export function writeProgress(key: string, state: GymState): void {
  try {
    storage()?.setItem(key, serialize(state))
  } catch {
    // Storage full or blocked: progress lives until the tab closes.
  }
  notify()
}

export function removeProgress(key: string): void {
  try {
    storage()?.removeItem(key)
  } catch {
    // Nothing to remove where nothing could be written.
  }
  notify()
}

/** Drops this plan's progress from other days, so storage never accumulates. */
export function purgeStaleProgress(slug: string, date: string): void {
  const s = storage()
  if (!s) return
  try {
    const prefix = `${STORAGE_PREFIX}${slug}:`
    const stale: string[] = []
    for (let i = 0; i < s.length; i++) {
      const key = s.key(i)
      if (key && key.startsWith(prefix) && !key.includes(`:${date}:`)) stale.push(key)
    }
    for (const key of stale) s.removeItem(key)
  } catch {
    // Best effort.
  }
}

export function readMuted(): boolean {
  try {
    return storage()?.getItem(MUTED_KEY) === '1'
  } catch {
    return false
  }
}

export function writeMuted(muted: boolean): void {
  try {
    if (muted) storage()?.setItem(MUTED_KEY, '1')
    else storage()?.removeItem(MUTED_KEY)
  } catch {
    // Mute then lasts for the session only.
  }
}

/** For `useSyncExternalStore`: re-read progress when this tab writes it or another tab does. */
export function subscribeProgress(callback: () => void): () => void {
  window.addEventListener(PROGRESS_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(PROGRESS_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/lib/gym-mode.ts`
Expected: no output from tsc, no errors from eslint.

- [ ] **Step 4: Check the rules with a throwaway script**

Create `.tmp-gym-check.mts` in the repo root (so `node_modules` resolves; **delete it in Step 5**):

```ts
import assert from 'node:assert/strict'
import {
  advancesWithoutRest, deserialize, formatCountdown, formatPrescription, formatSummary, initialState,
  progressLabel, reduce, serialize, setsDone, storageKey, summary,
} from './src/lib/gym-mode'

const rows = [
  { sets: 4, rest: 90 },      // bench
  { sets: 3, rest: 60 },      // ohp
  { sets: null, rest: null }, // a row with no numbers → one circle, no timer
]
const t0 = 1_000_000

let s = initialState(rows)
assert.deepEqual(s.ticks, [[false, false, false, false], [false, false, false], [false]])
assert.equal(progressLabel(s), '1 of 3')
assert.equal(progressLabel(s, '/'), '1 / 3')

// Ticking starts the rest and records the start time.
s = reduce(s, { type: 'toggle-set', move: 0, set: 0, now: t0 }, rows)
assert.equal(s.startedAt, t0)
assert.deepEqual(s.rest, { move: 0, set: 0, endsAt: t0 + 90_000 })
assert.equal(setsDone(s, 0), 1)

// Un-ticking the resting set cancels its rest.
s = reduce(s, { type: 'toggle-set', move: 0, set: 0, now: t0 + 5_000 }, rows)
assert.equal(s.rest, null)
assert.equal(setsDone(s, 0), 0)
assert.equal(s.startedAt, t0, 'start time is kept')

// Mid-move rest end: no advance.
for (let i = 0; i < 3; i++) s = reduce(s, { type: 'toggle-set', move: 0, set: i, now: t0 + 10_000 * i }, rows)
s = reduce(s, { type: 'rest-ended', now: t0 + 200_000 }, rows)
assert.equal(s.move, 0)
assert.equal(s.rest, null)

// Last set's rest end: advance to the next move.
s = reduce(s, { type: 'toggle-set', move: 0, set: 3, now: t0 + 300_000 }, rows)
assert.equal(advancesWithoutRest(s, 0, rows), false, 'a row with rest never advances without the timer')
s = reduce(s, { type: 'rest-ended', now: t0 + 390_000 }, rows)
assert.equal(s.move, 1)

// Jumping mid-rest: the rest keeps running; its end does not advance the other move.
s = reduce(s, { type: 'toggle-set', move: 1, set: 0, now: t0 + 400_000 }, rows)
s = reduce(s, { type: 'go-to', move: 2 }, rows)
assert.deepEqual(s.rest, { move: 1, set: 0, endsAt: t0 + 460_000 })
s = reduce(s, { type: 'skip-rest', now: t0 + 410_000 }, rows)
assert.equal(s.rest, null)
assert.equal(s.move, 2)

// A row with no rest and one circle advances without a timer; after the last move → finished.
s = reduce(s, { type: 'toggle-set', move: 2, set: 0, now: t0 + 420_000 }, rows)
assert.equal(s.rest, null)
assert.equal(advancesWithoutRest(s, 2, rows), true)
s = reduce(s, { type: 'advance', now: t0 + 420_400 }, rows)
assert.equal(s.finished, true)
assert.equal(s.finishedAt, t0 + 420_400)

// Summary: 3 moves, 6 ticked sets (4 + 1 + 1), 7 minutes.
assert.deepEqual(summary(s), { moves: 3, sets: 6, minutes: 7 })
assert.equal(formatSummary(summary(s)), '3 moves · 6 sets · 7 min')
assert.equal(formatSummary({ moves: 1, sets: 1, minutes: 0 }), '1 move · 1 set')

// Round trip and rejection of a mismatched plan.
assert.deepEqual(deserialize(serialize(s), rows), s)
assert.equal(deserialize(serialize(s), rows.slice(0, 2)), null, 'row count changed')
assert.equal(deserialize(serialize(s), [{ sets: 5, rest: 90 }, rows[1]!, rows[2]!]), null, 'set count changed')
assert.equal(deserialize('not json', rows), null)
assert.equal(deserialize(null, rows), null)

// Out-of-range actions are ignored.
const before = initialState(rows)
assert.equal(reduce(before, { type: 'toggle-set', move: 9, set: 0, now: t0 }, rows), before)
assert.equal(reduce(before, { type: 'go-to', move: -1 }, rows), before)

assert.equal(formatCountdown(90_000), '1:30')
assert.equal(formatCountdown(6_100), '0:07')
assert.equal(formatCountdown(0), '0:00')
assert.equal(formatCountdown(-500), '0:00')

assert.deepEqual(formatPrescription({ sets: 4, reps: 10, rest: 90, oneRm: 75, speed: '2/1/1' }), { big: '4 × 10', details: '90 s rest · 75% 1RM · 2/1/1' })
assert.deepEqual(formatPrescription({ sets: 1, reps: null, rest: 0, oneRm: null, speed: '  ' }), { big: '1 set', details: '' })
assert.deepEqual(formatPrescription({ sets: null, reps: 12, rest: null, oneRm: null, speed: null }), { big: '12 reps', details: '' })
assert.deepEqual(formatPrescription({ sets: null, reps: null, rest: null, oneRm: null, speed: null }), { big: null, details: '' })

assert.equal(storageKey('ljFXxhEJ_1TM', 2, '2026-09-24', 123), 'planit:gym:ljFXxhEJ_1TM:2:2026-09-24:123')
console.log('gym-mode rules OK')
```

Run: `npx tsx .tmp-gym-check.mts`
Expected: `gym-mode rules OK`. If an assertion fails, fix `src/lib/gym-mode.ts` (not the assertion) unless the assertion contradicts the spec.

- [ ] **Step 5: Delete the script and commit**

```bash
rm .tmp-gym-check.mts
git add src/lib/gym-mode.ts docs/superpowers/specs/2026-09-24-planit-gym-mode-design.md
git commit -m "feat: gym mode state rules and on-phone progress storage

Pure reducer, formatting and localStorage helpers for the share page's
workout player. Every time-dependent action carries its own timestamp so
the reducer never reads the clock. The spec now measures the finish
summary's minutes from the first ticked set.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Shared primitives — `DialogSheet` styling props, `MoveDetails` and `MoveChips`

**Files:**
- Modify: `src/components/ui/dialog-sheet.tsx`
- Create: `src/components/share/move-chips.tsx`
- Create: `src/components/share/move-details.tsx`
- Modify: `src/components/share/move-lightbox.tsx`

**Interfaces:**
- Produces: `DialogSheet` accepts `className?: string` and `style?: CSSProperties` applied to its popup. `MoveChips({ row, size?: 'sm' | 'md' })` renders the movement-type chip and the equipment chip. `MoveDetails({ row })` renders the lightbox body (figure or icon, chips, muscles worked, tutorial button). `MoveLightbox` keeps its exact props and behaviour.

- [ ] **Step 1: Give `DialogSheet` `className` and `style`**

Replace the whole file `src/components/ui/dialog-sheet.tsx` with:

```tsx
'use client'

import * as React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A bottom sheet that can open on top of a Base UI `Dialog`. The app's `BottomSheet` is vaul,
 * and a vaul sheet over a modal Base UI dialog fights it for focus and outside presses; nested
 * Base UI dialogs stack natively. It matches `BottomSheet`'s look (slides up, rounded top,
 * `md` max width) — with an X instead of a drag handle, since it can't be swiped away.
 *
 * `className` / `style` land on the popup: it portals to `body`, so a caller inside a scoped
 * theme (the gym player's `dark` scope and its `--brand`) passes them through explicitly.
 */
export function DialogSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  style,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const popupRef = React.useRef<HTMLDivElement>(null)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* A nested dialog's backdrop only renders when forced. */}
        <DialogPrimitive.Backdrop
          forceRender
          className="fixed inset-0 z-50 bg-black/40 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        {/* Focus lands on the sheet, not its X, so opening it doesn't flash a focus ring. */}
        <DialogPrimitive.Popup
          ref={popupRef}
          initialFocus={popupRef}
          tabIndex={-1}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full flex-col rounded-t-2xl bg-popover text-sm text-popover-foreground outline-none ring-1 ring-foreground/10 duration-200 data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom md:max-w-lg',
            className,
          )}
          style={style}
        >
          <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3">
            <DialogPrimitive.Title className="font-heading text-base leading-none font-medium">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close"
              className="-mr-2 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
            {children}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
```

- [ ] **Step 2: Create `src/components/share/move-chips.tsx`**

```tsx
import { EquipmentIcon } from '@/components/shared/equipment-icon'
import { cn } from '@/lib/utils'
import type { SharedRow } from '@/services/share'

/**
 * A move's two chips — movement type and the equipment it's done with — as the lightbox and
 * the gym player show them. `md` is the player's slightly larger size.
 */
export function MoveChips({ row, size = 'sm' }: { row: SharedRow; size?: 'sm' | 'md' }) {
  const md = size === 'md'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={cn(
          'inline-flex shrink-0 items-center rounded-full border border-input bg-background font-medium text-muted-foreground',
          md ? 'h-6 px-2.5 text-[11px]' : 'h-5 px-2 text-[10px]',
        )}
      >
        {row.movementType.charAt(0).toUpperCase() + row.movementType.slice(1)}
      </span>
      {row.equipment && (
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full border border-input font-medium text-muted-foreground',
            md ? 'h-6 px-2.5 text-[12px]' : 'px-2 py-0.5 text-[11px]',
          )}
        >
          <EquipmentIcon src={row.equipment.imageUrl} className="size-3.5" />
          {row.equipment.name}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/share/move-details.tsx`**

```tsx
'use client'

import { MuscleMap } from '@/components/shared/muscle-map'
import { EquipmentIcon } from '@/components/shared/equipment-icon'
import { MusclePill } from '@/components/shared/muscle-pill'
import { Button } from '@/components/ui/button'
import { shadesForMove } from '@/lib/muscle-map'
import type { SharedRow } from '@/services/share'
import { MoveChips } from './move-chips'

/**
 * Everything the share page knows about one move: the body figure (or the equipment icon for a
 * move with no muscle targets), its chips, the muscles it works and the tutorial link. The share
 * page shows it in a vaul sheet (`MoveLightbox`); the gym player shows it in a `DialogSheet`.
 */
export function MoveDetails({ row }: { row: SharedRow }) {
  // Same precedence as `MoveThumbnail`: the body figure, else the equipment icon.
  const showBodyHero = row.muscles.length > 0

  return (
    <div className="space-y-4">
      {showBodyHero ? (
        <div className="flex h-[min(40dvh,20rem)] items-center justify-center rounded-xl border bg-muted/40 p-5">
          <MuscleMap
            shades={shadesForMove(row.muscles)}
            label={`Muscles worked: ${row.muscles.map((m) => m.name).join(', ')}`}
            className="size-full justify-center"
          />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border bg-muted/40 text-muted-foreground">
          <EquipmentIcon src={row.equipment?.imageUrl ?? null} className="size-16" />
        </div>
      )}
      <MoveChips row={row} />
      {row.muscles.length > 0 && (
        <div className="space-y-1.5 rounded-xl border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Works</p>
          <div className="flex flex-wrap gap-1.5">
            {row.muscles.map((m) => (
              <MusclePill key={m.name} name={m.name} primary={m.primary} />
            ))}
          </div>
        </div>
      )}
      {row.exercise.tutorialUrl && (
        <Button
          size="lg"
          className="h-11 w-full bg-brand text-brand-foreground hover:bg-brand/90"
          nativeButton={false}
          render={<a href={row.exercise.tutorialUrl} target="_blank" rel="noopener noreferrer" />}
        >
          Watch tutorial
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Make `MoveLightbox` a thin wrapper**

Replace the whole file `src/components/share/move-lightbox.tsx` with:

```tsx
'use client'

import {
  BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle,
} from '@/components/ui/bottom-sheet'
import type { SharedRow } from '@/services/share'
import { MoveDetails } from './move-details'

/** The share page's move sheet: `MoveDetails` in a vaul bottom sheet, titled with the move. */
export function MoveLightbox({
  row,
  open,
  onOpenChange,
}: {
  row: SharedRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        {row && (
          <>
            <BottomSheetHeader>
              <BottomSheetTitle>{row.exercise.name}</BottomSheetTitle>
            </BottomSheetHeader>
            <MoveDetails row={row} />
          </>
        )}
      </BottomSheetContent>
    </BottomSheet>
  )
}
```

- [ ] **Step 5: Typecheck, lint, and check the lightbox is unchanged**

Run: `npx tsc --noEmit && npx eslint src`
Expected: clean (the two known warnings only).

Browser: open `http://localhost:3000/p/ljFXxhEJ_1TM` at 390×844, pick "Day 3", tap the "Bench press" card. The sheet must show the figure, the chips (`Push`, equipment), "Works" pills and (if the move has a tutorial URL) the button — visually identical to before this task. Then confirm the plan editor's Week view "Not trained" sheet (which uses `DialogSheet` without the new props) still opens normally on `/clients/5e7ca94a-df57-419d-bec6-4c1b1236c240/plans/cdc92ec4-5971-4d22-a2c6-86b7d84c8f0e` — this needs the coach cookie (see `AGENTS.md` §7 "Dev server").

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/dialog-sheet.tsx src/components/share/move-chips.tsx src/components/share/move-details.tsx src/components/share/move-lightbox.tsx
git commit -m "refactor: extract move details and chips from the share lightbox

The gym player needs the same move details inside a Base UI dialog, where
a vaul sheet can't open, so the lightbox body becomes MoveDetails and
DialogSheet learns className/style for scoped themes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Device hooks and signals

**Files:**
- Create: `src/components/share/gym-mode/signals.ts`
- Create: `src/components/share/gym-mode/use-wake-lock.ts`
- Create: `src/components/share/gym-mode/use-rest-clock.ts`
- Create: `src/components/share/gym-mode/use-play-param.ts`
- Create: `src/components/share/gym-mode/use-stored-progress.ts`

**Interfaces:**
- Consumes: from Task 1 — `readProgress`, `todayKey`, `progressLabel`, `subscribeProgress`, `GymRow`.
- Produces:
  - `primeAudio(): void`, `playChime(): void`, `buzz(): void`
  - `useWakeLock(active: boolean): void`
  - `useRestClock(endsAt: number | null, onEnd: (now: number) => void): number` — remaining ms in whole seconds, 0 when no rest
  - `usePlayParam(isPlayable: (day: number) => boolean): { playing: number | null; open: (day: number) => void; close: () => void }`
  - `useStoredProgress(slug: string, day: number, planUpdatedAt: number, rows: GymRow[]): string | null` — `"2 of 4"` or null

- [ ] **Step 1: Create `signals.ts`**

```ts
/**
 * The rest-end signals. The chime is synthesised with Web Audio (no asset, no network): two
 * short rising tones. iOS only lets a page make sound after a user gesture created the audio
 * context, so `primeAudio` is called from every set tick and the chime just plays later.
 * The buzz is the Vibration API, which iOS Safari doesn't have — that's why the chime exists.
 */

let context: AudioContext | null = null

/** Call from a user gesture (a set tick). Safe to call repeatedly. */
export function primeAudio(): void {
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
  } catch {
    context = null
  }
}

/** Two short rising tones, ~350 ms. Silent until `primeAudio` has run from a gesture. */
export function playChime(): void {
  if (!context) return
  try {
    const t0 = context.currentTime
    for (const [frequency, at] of [
      [880, 0],
      [1320, 0.14],
    ] as const) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, t0 + at)
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.18)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(t0 + at)
      oscillator.stop(t0 + at + 0.2)
    }
  } catch {
    // An interrupted context; the buzz still fires.
  }
}

export function buzz(): void {
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // Not supported: nothing to do.
  }
}
```

- [ ] **Step 2: Create `use-wake-lock.ts`**

```ts
'use client'

import { useEffect } from 'react'

/**
 * Keeps the screen on while `active`. The browser drops a wake lock whenever the tab is hidden,
 * so it is requested again each time the tab comes back. Unsupported or refused → nothing.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      try {
        const next = await navigator.wakeLock.request('screen')
        if (cancelled) void next.release()
        else sentinel = next
      } catch {
        // Low battery mode or an unsupported platform: the screen dims as usual.
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release()
    }
  }, [active])
}
```

- [ ] **Step 3: Create `use-rest-clock.ts`**

```ts
'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The remaining rest, recomputed from the end timestamp on each animation frame so a tab that
 * was backgrounded (music app, lock screen) never drifts. Returns whole seconds as ms — one
 * state update per second, not sixty. `onEnd` fires exactly once when the rest runs out; if it
 * ran out while the tab was hidden, it fires when the tab is visible again. 0 when no rest runs.
 */
export function useRestClock(endsAt: number | null, onEnd: (now: number) => void): number {
  const [remaining, setRemaining] = useState(0)
  const onEndRef = useRef(onEnd)
  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  useEffect(() => {
    if (endsAt === null) return
    let frame = 0
    let ended = false

    const tick = () => {
      const now = Date.now()
      const left = endsAt - now
      if (left <= 0) {
        if (!ended) {
          ended = true
          setRemaining(0)
          onEndRef.current(now)
        }
        return
      }
      setRemaining(Math.ceil(left / 1000) * 1000)
      frame = requestAnimationFrame(tick)
    }
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [endsAt])

  return endsAt === null ? 0 : remaining
}
```

Note for the implementer: on the very first frame after a rest starts, `remaining` is still the previous value (0). The move screen (Task 5) shows the row's full rest when `remainingMs` is 0, so nothing flashes.

- [ ] **Step 4: Create `use-play-param.ts`**

```ts
'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

const PARAM = 'play'

/**
 * The player's open state lives in the URL as `?play=<dayIndex>`, so the browser back button
 * (and an iOS edge swipe) closes the player instead of leaving the page. Next integrates
 * `history.pushState` / `replaceState` with its router, so `useSearchParams` follows them.
 *
 * `open` pushes an entry; `close` goes back to consume it. When the page was *loaded* with the
 * param (a reload, a pasted link) nothing was pushed, so `close` strips the param in place —
 * going back would leave the site. An invalid value is stripped on load and never opens anything.
 */
export function usePlayParam(isPlayable: (day: number) => boolean): {
  playing: number | null
  open: (day: number) => void
  close: () => void
} {
  const searchParams = useSearchParams()
  const raw = searchParams.get(PARAM)
  const parsed = raw !== null && /^\d{1,2}$/.test(raw) ? Number(raw) : null
  const playing = parsed !== null && isPlayable(parsed) ? parsed : null
  const pushed = useRef(false)

  useEffect(() => {
    if (raw === null || playing !== null) return
    const url = new URL(window.location.href)
    url.searchParams.delete(PARAM)
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }, [raw, playing])

  const open = useCallback((day: number) => {
    const url = new URL(window.location.href)
    url.searchParams.set(PARAM, String(day))
    window.history.pushState(null, '', `${url.pathname}${url.search}`)
    pushed.current = true
  }, [])

  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false
      window.history.back()
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.delete(PARAM)
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }, [])

  return { playing, open, close }
}
```

- [ ] **Step 5: Create `use-stored-progress.ts`**

```ts
'use client'

import { useSyncExternalStore } from 'react'
import { progressLabel, readProgress, subscribeProgress, todayKey, type GymRow } from '@/lib/gym-mode'

const serverSnapshot = () => null

/**
 * "2 of 4" when this phone holds progress for the day today, else null — for the Start pill.
 * An external-store read rather than an effect: the server renders `Start`, the client swaps
 * in `Continue` on hydration without a mismatch, and every progress write re-reads it.
 */
export function useStoredProgress(
  slug: string,
  day: number,
  planUpdatedAt: number,
  rows: GymRow[],
): string | null {
  return useSyncExternalStore(
    subscribeProgress,
    () => {
      const saved = readProgress(todayKey(slug, day, planUpdatedAt), rows)
      return saved ? progressLabel(saved) : null
    },
    serverSnapshot,
  )
}
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src`
Expected: clean. If `WakeLockSentinel` or `navigator.wakeLock` is reported as unknown, the TypeScript `dom` lib in use is older than expected — check `node_modules/typescript/lib/lib.dom.d.ts` for `wakeLock` (it is present in the installed version) before adding any local type.

- [ ] **Step 7: Commit**

```bash
git add src/components/share/gym-mode/signals.ts src/components/share/gym-mode/use-wake-lock.ts src/components/share/gym-mode/use-rest-clock.ts src/components/share/gym-mode/use-play-param.ts src/components/share/gym-mode/use-stored-progress.ts
git commit -m "feat: gym mode device hooks — rest clock, wake lock, chime, URL state

The rest clock counts from an end timestamp so a backgrounded tab never
drifts; the chime is synthesised with Web Audio because iOS Safari has no
vibration; the player's open state is a search param pushed with the
history API so the back button closes it instead of leaving the page.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Set ticks, rest timer and move figure

**Files:**
- Create: `src/components/share/gym-mode/set-ticks.tsx`
- Create: `src/components/share/gym-mode/rest-timer.tsx`
- Create: `src/components/share/gym-mode/move-figure.tsx`

**Interfaces:**
- Consumes: `formatCountdown` (Task 1); `MuscleMap`, `shadesForMove`, `EquipmentIcon`, `cn`.
- Produces: `SetTicks({ ticks: boolean[]; onToggle: (set: number) => void })`, `RestTimer({ remainingMs: number; totalMs: number; onSkip: () => void })`, `MoveFigure({ row: SharedRow })`.

- [ ] **Step 1: Create `set-ticks.tsx`**

```tsx
'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * One big circle per set. Empty circles show their number; the first empty one is outlined in
 * the brand colour as "this one next"; done circles fill with brand and a check. Any circle
 * toggles. A lone circle (a row with no sets recorded) is a plain "Done" check.
 */
export function SetTicks({ ticks, onToggle }: { ticks: boolean[]; onToggle: (set: number) => void }) {
  const next = ticks.indexOf(false)
  const single = ticks.length === 1

  return (
    <div className="flex flex-wrap items-center justify-center gap-3.5 px-5">
      {ticks.map((done, i) => (
        <button
          key={i}
          type="button"
          aria-pressed={done}
          aria-label={single ? (done ? 'Done' : 'Mark done') : `Set ${i + 1}, ${done ? 'done' : 'not done'}`}
          onClick={() => onToggle(i)}
          className={cn(
            'flex size-15 touch-manipulation items-center justify-center rounded-full border-2 text-lg font-semibold tabular-nums outline-none transition-[transform,background-color,border-color,color] duration-200 active:scale-90 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            done
              ? 'border-brand bg-brand text-brand-foreground'
              : i === next
                ? 'border-brand text-brand'
                : 'border-border text-muted-foreground',
          )}
        >
          {done ? (
            <Check className="size-7 animate-in zoom-in-50 duration-300" strokeWidth={2.5} aria-hidden />
          ) : single ? (
            <Check className="size-7" strokeWidth={2.5} aria-hidden />
          ) : (
            i + 1
          )}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `rest-timer.tsx`**

```tsx
'use client'

import { SkipForward } from 'lucide-react'
import { formatCountdown } from '@/lib/gym-mode'

/**
 * The rest countdown that takes over the hero card: a kicker, the time as big as it gets, a
 * track that empties with it, and Skip. The track's width steps once a second and eases over
 * that second, so it reads as continuous.
 */
export function RestTimer({
  remainingMs,
  totalMs,
  onSkip,
}: {
  remainingMs: number
  totalMs: number
  onSkip: () => void
}) {
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0
  const time = formatCountdown(remainingMs)

  return (
    <div role="timer" aria-label={`Rest, ${time} left`} className="flex flex-col items-center gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Rest</p>
      <p className="text-7xl leading-none font-extrabold tracking-tighter tabular-nums">{time}</p>
      <div className="h-1.5 w-44 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-1000 ease-linear"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <button
        type="button"
        onClick={onSkip}
        className="mt-1 inline-flex h-10 touch-manipulation items-center gap-2 rounded-full border bg-background px-4 text-sm font-semibold outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand/50"
      >
        <SkipForward className="size-4" aria-hidden />
        Skip
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create `move-figure.tsx`**

```tsx
import { EquipmentIcon } from '@/components/shared/equipment-icon'
import { MuscleMap } from '@/components/shared/muscle-map'
import { shadesForMove } from '@/lib/muscle-map'
import type { SharedRow } from '@/services/share'

/**
 * The hero picture of a move in the player: the focus-cropped single body figure (the same
 * framing as `MoveThumbnail`, just large), or the equipment icon for a move with no muscle
 * targets. Fills whatever box it's given — give the box both dimensions.
 */
export function MoveFigure({ row }: { row: SharedRow }) {
  if (row.muscles.length > 0) {
    return (
      <MuscleMap
        shades={shadesForMove(row.muscles)}
        label={`${row.exercise.name}: works ${row.muscles.map((m) => m.name).join(', ')}`}
        single
        className="size-full justify-center"
      />
    )
  }
  return (
    <div role="img" aria-label={row.exercise.name} className="flex size-full items-center justify-center text-muted-foreground">
      <EquipmentIcon src={row.equipment?.imageUrl ?? null} className="size-24" />
    </div>
  )
}
```

- [ ] **Step 4: Typecheck and lint, then commit**

Run: `npx tsc --noEmit && npx eslint src`
Expected: clean.

```bash
git add src/components/share/gym-mode/set-ticks.tsx src/components/share/gym-mode/rest-timer.tsx src/components/share/gym-mode/move-figure.tsx
git commit -m "feat: gym mode set circles, rest countdown and move figure

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The move screen

**Files:**
- Create: `src/components/share/gym-mode/move-screen.tsx`

**Interfaces:**
- Consumes: Task 1 (`GymState`, `formatPrescription`, `progressLabel`, `restMs`, `setCount`, `setsDone`), Task 2 (`MoveChips`), Task 4 (`SetTicks`, `RestTimer`, `MoveFigure`), `MoveThumbnail`, `Button`.
- Produces:

```ts
export function MoveScreen(props: {
  session: SharedSession
  state: GymState
  /** Whole-second remaining rest from `useRestClock`; 0 when none runs. */
  remainingMs: number
  muted: boolean
  onToggleSet: (move: number, set: number) => void
  onSkipRest: () => void
  onGoTo: (move: number) => void
  onFinish: () => void
  onToggleMute: () => void
  onClose: () => void
  onOpenList: () => void
  onOpenDetails: (row: SharedRow) => void
}): JSX.Element | null
```

- [ ] **Step 1: Create `move-screen.tsx`**

```tsx
'use client'

import type { ReactNode } from 'react'
import { ChevronRight, Volume2, VolumeX, X } from 'lucide-react'
import { MoveThumbnail } from '@/components/shared/move-thumbnail'
import { Button } from '@/components/ui/button'
import { formatPrescription, progressLabel, restMs, setCount, setsDone, type GymState } from '@/lib/gym-mode'
import { cn } from '@/lib/utils'
import type { SharedRow, SharedSession } from '@/services/share'
import { MoveChips } from '../move-chips'
import { MoveFigure } from './move-figure'
import { RestTimer } from './rest-timer'
import { SetTicks } from './set-ticks'

function IconButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string
  pressed?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className="flex size-10 shrink-0 touch-manipulation items-center justify-center rounded-full bg-muted text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand/50"
    >
      {children}
    </button>
  )
}

/**
 * One move, top to bottom: top bar (close · day + counter · mute), a progress segment per move,
 * the hero card (the figure, or the rest countdown while resting), name + chips + numbers, the
 * set circles, and the Next up row (or Finish workout on the last move). Fits 390×844 without
 * scrolling; scrolls rather than clips on anything shorter.
 */
export function MoveScreen({
  session,
  state,
  remainingMs,
  muted,
  onToggleSet,
  onSkipRest,
  onGoTo,
  onFinish,
  onToggleMute,
  onClose,
  onOpenList,
  onOpenDetails,
}: {
  session: SharedSession
  state: GymState
  remainingMs: number
  muted: boolean
  onToggleSet: (move: number, set: number) => void
  onSkipRest: () => void
  onGoTo: (move: number) => void
  onFinish: () => void
  onToggleMute: () => void
  onClose: () => void
  onOpenList: () => void
  onOpenDetails: (row: SharedRow) => void
}) {
  const row = session.rows[state.move]
  if (!row) return null
  const next = session.rows[state.move + 1]
  const { big, details } = formatPrescription(row)

  // A rest keeps showing wherever the client is — they may have walked to the next station.
  const restRow = state.rest ? session.rows[state.rest.move] : undefined
  const resting = state.rest !== null && restRow !== undefined
  const restTotalMs = restRow ? restMs(restRow) : 0
  // The clock's first frame hasn't run yet right after a tick: show the full rest, not 0:00.
  const shownMs = remainingMs > 0 ? remainingMs : restTotalMs

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:pt-1 sm:pb-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-5 pt-3">
        <IconButton label="Close" onClick={onClose}>
          <X className="size-5" aria-hidden />
        </IconButton>
        <button
          type="button"
          onClick={onOpenList}
          aria-label={`Move ${progressLabel(state)}. Open the move list`}
          className="min-w-0 rounded-lg px-2 py-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        >
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {session.label}
          </p>
          <p className="text-[15px] leading-tight font-bold tabular-nums">{progressLabel(state, '/')}</p>
        </button>
        <IconButton label={muted ? 'Unmute the chime' : 'Mute the chime'} pressed={muted} onClick={onToggleMute}>
          {muted ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
        </IconButton>
      </div>

      {/* One segment per move, filled by its ticked sets. */}
      <div className="flex gap-1.5 px-5 pt-3.5" aria-hidden>
        {session.rows.map((r, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-300"
              style={{ width: `${(setsDone(state, i) / setCount(r)) * 100}%` }}
            />
          </div>
        ))}
      </div>

      {/* Hero: the figure, which becomes the countdown while resting. Fixed height — nothing shifts. */}
      <div className="relative mx-5 mt-4 h-[min(36dvh,20rem)] shrink-0 overflow-hidden rounded-3xl border bg-card">
        <button
          type="button"
          onClick={() => onOpenDetails(row)}
          aria-label={`${row.exercise.name}: details`}
          disabled={resting}
          className={cn(
            'absolute inset-0 flex items-center justify-center p-4 outline-none transition-opacity duration-300 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-inset',
            resting && 'opacity-[0.12]',
          )}
        >
          <MoveFigure row={row} />
        </button>
        {resting && (
          <div className="absolute inset-0 flex items-center justify-center">
            <RestTimer remainingMs={shownMs} totalMs={restTotalMs} onSkip={onSkipRest} />
          </div>
        )}
      </div>

      {/* Name, chips, numbers, note */}
      <div className="px-5 pt-4">
        <button
          type="button"
          onClick={() => onOpenDetails(row)}
          className="block max-w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        >
          <h2 className="line-clamp-2 text-2xl font-extrabold tracking-tight text-balance">{row.exercise.name}</h2>
        </button>
        <div className="mt-2">
          <MoveChips row={row} size="md" />
        </div>
        {(big || details) && (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {big && <p className="text-[2rem] leading-none font-extrabold tracking-tight tabular-nums">{big}</p>}
            {details && <p className="text-[15px] font-medium text-muted-foreground">{details}</p>}
          </div>
        )}
        {row.note && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{row.note}</p>}
      </div>

      {/* Set circles take the remaining height, centred. */}
      <div className="flex min-h-0 flex-1 items-center justify-center py-4">
        <SetTicks ticks={state.ticks[state.move] ?? []} onToggle={(set) => onToggleSet(state.move, set)} />
      </div>

      {/* Next up, or Finish on the last move */}
      <div className="px-5">
        {next ? (
          <button
            type="button"
            onClick={() => onGoTo(state.move + 1)}
            className="flex w-full touch-manipulation items-center gap-3 rounded-2xl border bg-card p-3 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            <MoveThumbnail
              name={next.exercise.name}
              muscles={next.muscles}
              equipmentImageUrl={next.equipment?.imageUrl ?? null}
              className="size-11 rounded-xl"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Next up
              </span>
              <span className="block truncate text-[15px] font-semibold">{next.exercise.name}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        ) : (
          <Button
            onClick={onFinish}
            className="h-12 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground hover:bg-brand/90"
          >
            Finish workout
          </Button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck and lint, then commit**

Run: `npx tsc --noEmit && npx eslint src`
Expected: clean.

```bash
git add src/components/share/gym-mode/move-screen.tsx
git commit -m "feat: gym mode move screen

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Move list sheet and finish screen

**Files:**
- Create: `src/components/share/gym-mode/move-list-sheet.tsx`
- Create: `src/components/share/gym-mode/finish-screen.tsx`

**Interfaces:**
- Consumes: Task 1 (`GymState`, `setCount`, `setsDone`, `summary`, `formatSummary`), Task 2 (`DialogSheet` with `className`/`style`), `MoveThumbnail`, `MuscleMap`, `shadesForRows`, `musclesForRows`, `Button`.
- Produces:

```ts
export function MoveListSheet(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: SharedSession
  state: GymState
  onPick: (move: number) => void
  className?: string
  style?: CSSProperties
}): JSX.Element

export function FinishScreen(props: {
  headline: string          // "Push day"
  session: SharedSession
  state: GymState
  onDone: () => void
  onFlexIt: () => void
}): JSX.Element
```

- [ ] **Step 1: Create `move-list-sheet.tsx`**

```tsx
'use client'

import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { MoveThumbnail } from '@/components/shared/move-thumbnail'
import { DialogSheet } from '@/components/ui/dialog-sheet'
import { setCount, setsDone, type GymState } from '@/lib/gym-mode'
import { cn } from '@/lib/utils'
import type { SharedSession } from '@/services/share'

/**
 * The day's moves with their progress, to jump anywhere — the bench is taken, do the free
 * machine first. A nested Base UI dialog, because the player itself is one.
 */
export function MoveListSheet({
  open,
  onOpenChange,
  session,
  state,
  onPick,
  className,
  style,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: SharedSession
  state: GymState
  onPick: (move: number) => void
  className?: string
  style?: CSSProperties
}) {
  return (
    <DialogSheet open={open} onOpenChange={onOpenChange} title={session.label} className={className} style={style}>
      <ul className="space-y-1.5">
        {session.rows.map((row, i) => {
          const total = setCount(row)
          const done = setsDone(state, i)
          const complete = done === total
          const current = i === state.move
          return (
            <li key={i}>
              <button
                type="button"
                aria-current={current || undefined}
                onClick={() => onPick(i)}
                className={cn(
                  'flex w-full touch-manipulation items-center gap-3 rounded-xl p-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand/50',
                  current && 'bg-brand/10',
                )}
              >
                <MoveThumbnail
                  name={row.exercise.name}
                  muscles={row.muscles}
                  equipmentImageUrl={row.equipment?.imageUrl ?? null}
                  className="size-10 rounded-lg"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.exercise.name}</span>
                {complete ? (
                  <Check className="size-5 shrink-0 text-brand" aria-label="Complete" />
                ) : (
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    {done} / {total}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </DialogSheet>
  )
}
```

- [ ] **Step 2: Create `finish-screen.tsx`**

```tsx
'use client'

import { Flame } from 'lucide-react'
import { MuscleMap } from '@/components/shared/muscle-map'
import { Button } from '@/components/ui/button'
import { formatSummary, summary, type GymState } from '@/lib/gym-mode'
import { musclesForRows, shadesForRows } from '@/lib/muscle-map'
import type { SharedSession } from '@/services/share'

/**
 * After the last move: the day's shaded figure, what was done, and the two ways out — Flex it
 * (post a story card; the player closes first, the story sheet opens on the page) or Done.
 * Both clear the saved progress.
 */
export function FinishScreen({
  headline,
  session,
  state,
  onDone,
  onFlexIt,
}: {
  headline: string
  session: SharedSession
  state: GymState
  onDone: () => void
  onFlexIt: () => void
}) {
  const worked = musclesForRows(session.rows).map((m) => m.name).join(', ')

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:pt-6 sm:pb-6">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 text-center">
        <MuscleMap
          shades={shadesForRows(session.rows)}
          label={worked ? `Today you worked ${worked}` : "Today's workout"}
          className="h-[min(34dvh,18rem)] justify-center"
        />
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand">Workout done</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-balance">{headline}</h2>
          <p className="text-[15px] font-medium text-muted-foreground tabular-nums">{formatSummary(summary(state))}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-6">
        <Button
          onClick={onFlexIt}
          className="h-12 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground hover:bg-brand/90"
        >
          <Flame className="size-4" aria-hidden />
          Flex it
        </Button>
        <Button variant="outline" onClick={onDone} className="h-12 w-full rounded-2xl text-base font-semibold">
          Done
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck and lint, then commit**

Run: `npx tsc --noEmit && npx eslint src`
Expected: clean.

```bash
git add src/components/share/gym-mode/move-list-sheet.tsx src/components/share/gym-mode/finish-screen.tsx
git commit -m "feat: gym mode move list and finish screen

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The player shell (`GymMode`)

**Files:**
- Create: `src/components/share/gym-mode/gym-mode.tsx`

**Interfaces:**
- Consumes: everything above; `Dialog`, `DialogContent`, `DialogTitle` from `@/components/ui/dialog`; `MoveDetails` (Task 2).
- Produces:

```ts
export function GymMode(props: {
  open: boolean
  slug: string
  /** Day index the player is for; ignored while `session` is undefined. */
  day: number
  session: SharedSession | undefined
  /** "Push day" — the finish screen's title. */
  headline: string
  planUpdatedAt: number
  brand: string
  /** Asked to close (X, Escape, Done, Flex it). The parent flips `open` via the URL. */
  onClose: () => void
  /** The close animation finished — the parent may now open a vaul sheet. */
  onClosed: () => void
  /** Flex it on the finish screen: progress is already cleared; close, then open the story sheet. */
  onFlexIt: () => void
}): JSX.Element
```

- [ ] **Step 1: Create `gym-mode.tsx`**

```tsx
'use client'

import { useEffect, useReducer, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DialogSheet } from '@/components/ui/dialog-sheet'
import {
  advancesWithoutRest, initialState, purgeStaleProgress, readMuted, readProgress, reduce, removeProgress,
  todayDate, todayKey, writeMuted, writeProgress, type GymAction, type GymState,
} from '@/lib/gym-mode'
import type { SharedRow, SharedSession } from '@/services/share'
import { MoveDetails } from '../move-details'
import { FinishScreen } from './finish-screen'
import { MoveListSheet } from './move-list-sheet'
import { MoveScreen } from './move-screen'
import { buzz, playChime, primeAudio } from './signals'
import { useRestClock } from './use-rest-clock'
import { useWakeLock } from './use-wake-lock'

/** How long the last tick's pop plays before a row with no rest moves on. */
const NO_REST_ADVANCE_MS = 400

const subscribeNothing = () => () => {}
/** True after hydration. The player body reads localStorage while initialising, which the server can't. */
function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNothing, () => true, () => false)
}

/**
 * The full-screen workout player: a Base UI dialog in the app's `dark` token scope, on the
 * header band's near-black, carrying the coach's `--brand` (it portals out of the share view).
 * The body mounts per plan + day and only on the client.
 */
export function GymMode({
  open,
  slug,
  day,
  session,
  headline,
  planUpdatedAt,
  brand,
  onClose,
  onClosed,
  onFlexIt,
}: {
  open: boolean
  slug: string
  day: number
  session: SharedSession | undefined
  headline: string
  planUpdatedAt: number
  brand: string
  onClose: () => void
  onClosed: () => void
  onFlexIt: () => void
}) {
  const isClient = useIsClient()
  const showing = open && isClient && session !== undefined
  useWakeLock(showing)

  const theme = {
    '--brand': brand,
    '--background': '#0f0f0f',
    '--card': 'rgba(255,255,255,0.06)',
  } as CSSProperties

  return (
    <Dialog
      open={showing}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      onOpenChangeComplete={(next) => {
        if (!next) onClosed()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="dark inset-0 top-0 left-0 flex h-dvh max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-background p-0 text-foreground ring-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(90dvh,52rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:ring-1"
        style={theme}
      >
        {session && (
          <Player
            key={`${slug}:${day}:${planUpdatedAt}`}
            slug={slug}
            day={day}
            session={session}
            headline={headline}
            planUpdatedAt={planUpdatedAt}
            theme={theme}
            onClose={onClose}
            onFlexIt={onFlexIt}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Player({
  slug,
  day,
  session,
  headline,
  planUpdatedAt,
  theme,
  onClose,
  onFlexIt,
}: {
  slug: string
  day: number
  session: SharedSession
  headline: string
  planUpdatedAt: number
  theme: CSSProperties
  onClose: () => void
  onFlexIt: () => void
}) {
  const rows = session.rows
  // The key is fixed for this mount: a workout that crosses midnight keeps its progress.
  const [key] = useState(() => todayKey(slug, day, planUpdatedAt))
  const [state, dispatch] = useReducer(
    (current: GymState, action: GymAction) => reduce(current, action, rows),
    rows,
    (initialRows) => readProgress(key, initialRows) ?? initialState(initialRows),
  )
  const [muted, setMuted] = useState(readMuted)
  const [listOpen, setListOpen] = useState(false)
  const [details, setDetails] = useState<SharedRow | null>(null)
  const advanceTimer = useRef<number | null>(null)

  // Yesterday's progress for this plan is dropped once per opening; today's is written on every change.
  useEffect(() => {
    purgeStaleProgress(slug, todayDate())
  }, [slug])
  useEffect(() => {
    writeProgress(key, state)
  }, [key, state])
  useEffect(
    () => () => {
      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current)
    },
    [],
  )

  const remainingMs = useRestClock(state.rest?.endsAt ?? null, (now) => {
    dispatch({ type: 'rest-ended', now })
    buzz()
    if (!muted) playChime()
  })

  function toggleSet(move: number, set: number) {
    primeAudio()
    const now = Date.now()
    const action: GymAction = { type: 'toggle-set', move, set, now }
    const next = reduce(state, action, rows)
    dispatch(action)
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    if (advancesWithoutRest(next, move, rows)) {
      advanceTimer.current = window.setTimeout(() => {
        advanceTimer.current = null
        dispatch({ type: 'advance', now: Date.now() })
      }, NO_REST_ADVANCE_MS)
    }
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    writeMuted(next)
  }

  function done() {
    removeProgress(key)
    onClose()
  }

  function flexIt() {
    removeProgress(key)
    onFlexIt()
  }

  return (
    <>
      <DialogTitle className="sr-only">Gym mode: {session.label}</DialogTitle>
      {state.finished ? (
        <FinishScreen headline={headline} session={session} state={state} onDone={done} onFlexIt={flexIt} />
      ) : (
        <MoveScreen
          session={session}
          state={state}
          remainingMs={remainingMs}
          muted={muted}
          onToggleSet={toggleSet}
          onSkipRest={() => dispatch({ type: 'skip-rest', now: Date.now() })}
          onGoTo={(move) => dispatch({ type: 'go-to', move })}
          onFinish={() => dispatch({ type: 'finish', now: Date.now() })}
          onToggleMute={toggleMute}
          onClose={onClose}
          onOpenList={() => setListOpen(true)}
          onOpenDetails={setDetails}
        />
      )}
      <MoveListSheet
        open={listOpen}
        onOpenChange={setListOpen}
        session={session}
        state={state}
        onPick={(move) => {
          dispatch({ type: 'go-to', move })
          setListOpen(false)
        }}
        className="dark"
        style={theme}
      />
      <DialogSheet
        open={details !== null}
        onOpenChange={(next) => {
          if (!next) setDetails(null)
        }}
        title={details?.exercise.name ?? ''}
        className="dark"
        style={theme}
      >
        {details && <MoveDetails row={details} />}
      </DialogSheet>
    </>
  )
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src`
Expected: clean. Watch specifically for `react-hooks/set-state-in-effect` (there must be no `setX`/`dispatch` directly in an effect body — the three effects above only call storage helpers) and `react-hooks/purity` (no `Date.now()` outside handlers/callbacks). If the `Dialog` wrapper rejects `onOpenChangeComplete`, it forwards all `DialogPrimitive.Root.Props`, so check the import path is `@/components/ui/dialog`, not a stale type.

- [ ] **Step 3: Commit**

```bash
git add src/components/share/gym-mode/gym-mode.tsx
git commit -m "feat: gym mode player shell — dark dialog, reducer wiring, memory, signals

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Wire it into the share page and check the whole flow

**Files:**
- Modify: `src/components/share/share-session.tsx`
- Modify: `src/components/share/share-view.tsx`

**Interfaces:**
- Consumes: `GymMode` (Task 7), `usePlayParam`, `useStoredProgress` (Task 3), `dayFocus`/`FOCUS_TITLE`, `StorySheet`.
- Produces: `ShareSession` gains required props `startLabel: string` and `onStart: () => void`.

- [ ] **Step 1: Add the Start pill to `ShareSession`**

In `src/components/share/share-session.tsx`:

Change the import line `import { Angle, Clock, HeartPulse } from 'lucide-react'` to:

```tsx
import { Angle, Clock, HeartPulse, Play } from 'lucide-react'
```

Change the signature to:

```tsx
export function ShareSession({
  session,
  startLabel,
  onStart,
}: {
  session: SharedSession
  /** "Start", or "Continue · 2 of 4" when the phone holds today's progress. */
  startLabel: string
  onStart: () => void
}) {
```

Replace the Workout section's header paragraph

```tsx
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Workout
          </p>
```

with a header row that carries the pill:

```tsx
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Workout
            </p>
            {/* Opens Gym Mode for this day. Styled like Flex it: a brand-tinted pill, not another chip. */}
            <button
              type="button"
              onClick={onStart}
              className="inline-flex h-9 shrink-0 touch-manipulation items-center gap-1.5 rounded-full bg-brand/10 px-4 text-sm font-semibold text-brand outline-none transition-colors hover:bg-brand/15 focus-visible:ring-2 focus-visible:ring-brand/50"
            >
              <Play className="size-3.5 fill-current" aria-hidden />
              {startLabel}
            </button>
          </div>
```

(The section already renders only when `session.rows.length > 0`, so a day without moves has no pill.)

- [ ] **Step 2: Rewrite `ShareView`**

Replace the whole file `src/components/share/share-view.tsx` with:

```tsx
'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { Flame } from 'lucide-react'
import { EmptyState } from '@/components/shell/empty-state'
import { FOCUS_TITLE, dayFocus } from '@/lib/day-focus'
import { cn } from '@/lib/utils'
import type { SharedPlan, SharedSession } from '@/services/share'
import { GymMode } from './gym-mode/gym-mode'
import { usePlayParam } from './gym-mode/use-play-param'
import { useStoredProgress } from './gym-mode/use-stored-progress'
import { ShareHeader } from './share-header'
import { ShareSession } from './share-session'
import { StorySheet } from './story-sheet'

/** "Push day" — the story cards' and the finish screen's title for a day. */
function dayHeadline(session: SharedSession): string {
  return `${FOCUS_TITLE[dayFocus(session.rows, session.cardioMinutes)]} day`
}

export function ShareView({ plan, slug }: { plan: SharedPlan; slug: string }) {
  const { playing, open: openPlayer, close: closePlayer } = usePlayParam(
    (day) => (plan.sessions[day]?.rows.length ?? 0) > 0,
  )
  // A link straight into the player also selects its day chip.
  const [selected, setSelected] = useState(playing ?? 0)
  const [storyOpen, setStoryOpen] = useState(false)
  // Flex it on the finish screen: the vaul story sheet opens once the player's dialog has closed.
  const flexAfterClose = useRef(false)
  const session = plan.sessions[selected]
  const brand = plan.coach.brandColor || '#FE2E00'
  const headline = session ? dayHeadline(session) : ''
  const planUpdatedAt = plan.plan.updatedAt.getTime()
  const progress = useStoredProgress(slug, selected, planUpdatedAt, session?.rows ?? [])
  const playingSession = playing !== null ? plan.sessions[playing] : undefined

  return (
    <div
      className="min-h-dvh bg-background text-foreground"
      style={{ '--brand': brand } as CSSProperties}
    >
      <ShareHeader coach={plan.coach} client={plan.client} slug={slug} />

      {/* Capped and centred: plan content gains nothing from a wide monitor's full width. */}
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-3 px-4 pt-4">
          <h1 className="min-w-0 pt-1 text-xl font-bold tracking-tight text-balance">{plan.plan.title}</h1>
          {session && (
            // Turns the selected day into an Instagram story card.
            <button
              type="button"
              onClick={() => setStoryOpen(true)}
              // Brand tint like a primary muscle pill, so it doesn't read as another selected day chip.
              className="inline-flex h-9 shrink-0 touch-manipulation items-center gap-1.5 rounded-full bg-brand/10 px-4 text-sm font-semibold text-brand outline-none transition-colors hover:bg-brand/15 focus-visible:ring-2 focus-visible:ring-brand/50"
            >
              <Flame className="size-4" aria-hidden />
              Flex it
            </button>
          )}
        </div>

        {plan.sessions.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none]">
            {plan.sessions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(i)}
                className={cn(
                  'min-h-9 shrink-0 touch-manipulation rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                  i === selected
                    ? 'border-brand bg-brand text-brand-foreground'
                    : 'bg-card text-muted-foreground',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <main className="px-4 pt-2 pb-10">
          {session ? (
            <ShareSession
              key={selected}
              session={session}
              startLabel={progress ? `Continue · ${progress}` : 'Start'}
              onStart={() => openPlayer(selected)}
            />
          ) : (
            <EmptyState
              title="No sessions yet"
              description="Your coach hasn't added any days to this plan."
            />
          )}
        </main>
      </div>

      <StorySheet
        open={storyOpen}
        onOpenChange={setStoryOpen}
        slug={slug}
        dayIndex={selected}
        headline={headline}
        clientName={plan.client.name}
        brand={brand}
        version={String(Math.max(plan.plan.updatedAt.getTime(), plan.coach.updatedAt.getTime()))}
      />

      <GymMode
        open={playing !== null}
        slug={slug}
        day={playing ?? selected}
        session={playingSession}
        headline={playingSession ? dayHeadline(playingSession) : headline}
        planUpdatedAt={planUpdatedAt}
        brand={brand}
        onClose={closePlayer}
        onClosed={() => {
          if (!flexAfterClose.current) return
          flexAfterClose.current = false
          setStoryOpen(true)
        }}
        onFlexIt={() => {
          flexAfterClose.current = true
          closePlayer()
        }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src`
Expected: clean.

- [ ] **Step 4: Browser check — the whole flow at 390×844**

Use the chrome-devtools MCP if it connects (`new_page` on `http://localhost:3000/p/ljFXxhEJ_1TM`, `emulate` a 390×844 mobile viewport). If the MCP browser is locked by another session, use the `chrome-devtools-cli` skill or headless Chrome screenshots. Work through, judging like a designer (no overflow, consistent gutters, nothing clipped, targets ≥ 40px):

1. Share page, day "Day 3": the Workout header shows `WORKOUT` left and a brand-tinted `▶ Start` pill right, same height as Flex it. Day "Legs Day" (rows with null numbers) also shows it. A day with no moves would show none.
2. Tap Start. The player fills the screen on `#0f0f0f`: close · `DAY 3` over `1 / 4` · speaker; four thin segments; hero card with the bench figure in brand on a grey silhouette; "Bench press"; `Push` and equipment chips; `4 × 10` with `90 s rest`; four circles, the first outlined brand; Next up row with the next move's thumbnail. Nothing scrolls. The URL now ends in `?play=2`.
3. Tap circle 1: it fills brand with a check and pops; the hero fades and shows `REST` / `1:30` / track / Skip. The first segment is a quarter full. Tap Skip: the figure returns, silently.
4. Tap circle 2, wait until 0:00 (or temporarily set the row's rest low in your head — don't edit production data): at zero the figure returns. In the console, `navigator.vibrate` is a no-op on desktop; that's expected.
5. Tap circle 2 again (un-tick) while its rest runs: the rest disappears.
6. Tick circles 2, 3, 4 with Skip in between; on the fourth tick's rest, let it run out or Skip: the player advances to move 2 by itself. The top counter reads `2 / 4`.
7. Tap `2 / 4`: a dark sheet lists the moves — the first shows a brand check, the current is tinted, the others `0 / n`. Tap the last move: the sheet closes, the player shows it, the Next up row is now a brand `Finish workout` button.
8. Tap the hero: a dark details sheet with figure, chips, muscles, tutorial button (if any). Close it.
9. Tap the mute icon: it becomes `VolumeX`. Reload the page with `?play=2` in the URL: the player reopens on the same move with the same ticks, mute still on.
10. Press the browser back button: the player closes and the share page is where it was, with the Workout pill now reading `Continue · 4 of 4`. Tap it: the player reopens. Tap the X: closes, and the URL has no `?play`.
11. Open again, tap `Finish workout`: the finish screen shows the day's two figures, `WORKOUT DONE`, the headline (e.g. "Push day"), and a line like `4 moves · 4 sets · N min`. Tap Done: the player closes, the pill says `Start` again.
12. Open again, tick anything, `Finish workout`, then `Flex it`: the player closes and the story sheet slides up for that day.
13. Switch to "Legs Day" (null numbers): each move shows one circle with a check outline; ticking it advances after ~400 ms with no timer; the last one goes to the finish screen; the summary has no minutes-only nonsense (`2 moves · 2 sets` plus minutes if >0).
14. Visit `/p/ljFXxhEJ_1TM?play=9` and `?play=abc`: the page renders, no player, and the address bar loses the param without adding a history entry (back goes to the previous site/tab, not to the same page).

Fix anything that fails or looks wrong before moving on. Every visual fix belongs in the component that owns it (e.g. a padding problem in all sheets goes in `DialogSheet`).

- [ ] **Step 5: Browser check — desktop**

At 1280 wide: the player is a centred `max-w-md` panel, `min(90dvh, 52rem)` tall, rounded, over the dimmed page, with the same content and behaviour. The sheets open over it centred at `md:max-w-lg`. No white flashes anywhere inside the player.

- [ ] **Step 6: Commit**

```bash
git add src/components/share/share-session.tsx src/components/share/share-view.tsx
git commit -m "feat: Gym Mode on the share page

A Start pill in the day's Workout header opens a full-screen player: one
move at a time with the body figure, tappable set circles, an automatic
rest countdown with chime and buzz, the screen kept awake, and a finish
screen that hands off to the story cards. Progress lives on the phone for
the day only; the back button closes the player instead of the page.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Production build, docs, backlog

**Files:**
- Modify: `AGENTS.md` (§5 "Share page and PDF", §9 "What's shipped")
- Modify: `BACKLOG.md` (remove item 4)

- [ ] **Step 1: Production build**

Run: `npx next build`
Expected: succeeds with no errors (the `useSearchParams` Suspense error cannot occur: the share page is `force-dynamic`). Then **restart the dev server** (`next dev` on port 3000 — kill the running one first) because the build overwrites its cache.

- [ ] **Step 2: Document the feature in `AGENTS.md`**

In §5, after the paragraph beginning "`/p/[slug]` is public, needs no login…", add:

```markdown
- **Gym Mode** (`src/components/share/gym-mode/`): a `Start` pill in the day's Workout header
  opens a full-screen dark player — one move at a time, tappable set circles, an automatic rest
  countdown (Web Audio chime + vibration, one mute toggle), wake lock, a move list to jump around,
  and a finish screen that hands off to the story cards. Pure rules live in `src/lib/gym-mode.ts`.
  Progress is kept in `localStorage` for the plan + day + local date + plan `updatedAt` only;
  nothing is sent to the server. The open state is `?play=<day>` pushed with the history API, so
  the back button closes the player. Sheets over the player are `DialogSheet`s (it's a Base UI
  dialog). The player wraps its popup in the `dark` token scope with `--background` set to the
  header band's `#0f0f0f`; anything it portals out (the two sheets) gets the same class and style.
```

In §9, change the end of the shipped list from

```
→ Week-view gap suggestions → share page polish. Next up: [`BACKLOG.md`](BACKLOG.md).
```

to

```
→ Week-view gap suggestions → share page polish → WhatsApp send + link preview → story cards →
smart row defaults → Gym Mode on the share page. Next up: [`BACKLOG.md`](BACKLOG.md).
```

(Check the current text of §9 first; items 1–3 may already be listed — don't duplicate them.)

- [ ] **Step 3: Remove item 4 from `BACKLOG.md`**

Delete the whole `## 4. Gym Mode on the share page` section (heading and its four bullets). Leave everything else as is. If items 1–3 have already been removed by earlier work and the file would become empty, keep the header paragraph and add a single line `_Nothing queued — add the next feature here._`.

- [ ] **Step 4: Final checks**

Run: `npx tsc --noEmit && npx eslint src`
Expected: clean. Reload `http://localhost:3000/p/ljFXxhEJ_1TM` once on the restarted dev server and open the player to confirm it still works after the build.

- [ ] **Step 5: Commit (do not push)**

```bash
git add AGENTS.md BACKLOG.md
git commit -m "docs: record Gym Mode in the agent guide, clear it from the backlog

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Then report to the owner: what shipped, what was verified in the browser, what needs a real phone (chime, buzz, wake lock), and wait for the deploy go-ahead. **Do not push.**
