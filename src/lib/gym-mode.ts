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

/**
 * Rollout gate: Gym Mode stays hidden until this phone has opened the share link with
 * `?experimental_start=1` once; that visit flips the switch here for good. Not slug-scoped, so
 * the daily purge never touches it.
 */
export const ENABLED_KEY = 'planit:gym:enabled'

export function readEnabled(): boolean {
  try {
    return storage()?.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

export function writeEnabled(): void {
  try {
    storage()?.setItem(ENABLED_KEY, '1')
  } catch {
    // Without storage the flag only lasts while the URL carries it.
  }
  notify()
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
