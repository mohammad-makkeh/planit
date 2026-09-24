import { musclesForRows, type MuscleWork } from './muscle-map'

/**
 * What a training day is *about*, read from the work itself rather than the label the coach typed
 * ("Day 2", "Monday" and "Upper A" say nothing). Drives the share card's title and slogan.
 */
export type DayFocus =
  | 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'glutes' | 'core'
  | 'push' | 'pull' | 'upper' | 'full-body' | 'cardio' | 'workout'

export type FocusRow = {
  exercise: { name: string }
  muscles: MuscleWork[]
  sets: number | null
  movementType: 'push' | 'pull' | 'static'
}

type Group = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core'

/** Catalog muscle (lowercased) → body part. A muscle missing here counts toward nothing. */
const GROUP_BY_MUSCLE: Record<string, Group> = {
  'upper chest': 'chest', 'middle chest': 'chest', 'lower chest': 'chest',
  lats: 'back', 'upper back': 'back', 'lower back': 'back',
  'front shoulder': 'shoulders', 'side shoulder': 'shoulders', 'rear shoulder': 'shoulders',
  biceps: 'arms', triceps: 'arms', forearms: 'arms',
  abs: 'core', obliques: 'core',
  glutes: 'legs', quads: 'legs', hamstrings: 'legs', calves: 'legs',
}

/** Muscles that press vs. muscles that pull — how a move untagged as push/pull gets sorted. */
const PUSH_MUSCLES = new Set(['upper chest', 'middle chest', 'lower chest', 'front shoulder', 'side shoulder', 'triceps'])
const PULL_MUSCLES = new Set(['lats', 'upper back', 'rear shoulder', 'biceps', 'forearms'])

/** One body part carrying this share of the day's volume names the day. */
const DOMINANT = 0.6
/** Upper-body days (and lower-body days) are the ones where that half carries this much. */
const HALF = 0.75
/** A day is push (or pull) when this share of its upper-body moves press (or pull). */
const DIRECTION = 0.7
/** A leg day becomes a glutes day when glutes carry this share of the leg muscles' volume. */
const GLUTE_LED = 0.45
/** Full body needs real work from both halves, not a token move. */
const FULL_BODY_HALF = 0.25
/** …and upper-body work spanning this many of chest, back and shoulders (not a lone curl). */
const FULL_BODY_UPPER_PARTS = 2
/** How much a secondary muscle counts when deciding what a move is for. */
const SECONDARY_WEIGHT = 0.25

const UPPER: Group[] = ['chest', 'back', 'shoulders', 'arms']

const key = (name: string) => name.trim().toLowerCase()
const group = (name: string): Group | undefined => GROUP_BY_MUSCLE[key(name)]

/**
 * What a move is *for*: the body part with the most primary muscles, secondaries breaking ties.
 * Bench press lists front delts and triceps too, but it's a chest move — counting every muscle's
 * volume instead would make a day of pure chest pressing read as a mixed push day. An exact tie
 * goes to the part listed first (the catalog lists muscles top to bottom).
 */
function mainGroup(row: FocusRow): Group | undefined {
  const score = new Map<Group, number>()
  for (const m of row.muscles) {
    const g = group(m.name)
    if (g) score.set(g, (score.get(g) ?? 0) + (m.primary ? 1 : SECONDARY_WEIGHT))
  }
  let best: Group | undefined
  for (const [g, value] of score) if (best === undefined || value > score.get(best)!) best = g
  return best
}

/**
 * The day's focus, from most to least specific:
 *  1. nothing trained → cardio (if it has cardio) or a plain workout;
 *  2. moves for one body part carry ≥60% of the sets → that part (legs led by glutes → glutes);
 *  3. an upper-body day where most moves press or most pull → push / pull, else upper body;
 *  4. a lower-body day → legs / glutes;
 *  5. legs plus upper work across chest/back/shoulders → full body;
 *  6. core carries most of what's left → core, else a plain workout.
 * Each move counts once, by its sets (no sets counts as one), toward the part it's for. Core
 * moves are left out of the half/direction maths — a plank finisher doesn't change what a push
 * day is.
 */
export function dayFocus(rows: FocusRow[], cardioMinutes: number | null): DayFocus {
  const byGroup = new Map<Group, number>()
  for (const row of rows) {
    const g = mainGroup(row)
    if (g) byGroup.set(g, (byGroup.get(g) ?? 0) + (row.sets ?? 1))
  }
  const total = [...byGroup.values()].reduce((a, b) => a + b, 0)
  if (total === 0) return cardioMinutes ? 'cardio' : 'workout'
  const of = (g: Group) => byGroup.get(g) ?? 0

  const [top] = [...byGroup.entries()].sort((a, b) => b[1] - a[1])
  if (top && top[1] / total >= DOMINANT) return top[0] === 'legs' ? legsOrGlutes(rows) : top[0]

  const trained = total - of('core')
  if (trained === 0) return 'core'
  const upper = UPPER.reduce((sum, g) => sum + of(g), 0) / trained
  const lower = of('legs') / trained

  if (upper >= HALF) {
    const push = directionShare(rows)
    if (push >= DIRECTION) return 'push'
    if (push <= 1 - DIRECTION) return 'pull'
    return 'upper'
  }
  if (lower >= HALF) return legsOrGlutes(rows)
  const upperParts = (['chest', 'back', 'shoulders'] as const).filter((g) => of(g) > 0).length
  if (upper >= FULL_BODY_HALF && lower >= FULL_BODY_HALF && upperParts >= FULL_BODY_UPPER_PARTS) return 'full-body'
  return of('core') / total > 0.5 ? 'core' : 'workout'
}

/** A leg day is a glutes day when glutes carry a big share of the leg muscles' volume. */
function legsOrGlutes(rows: FocusRow[]): DayFocus {
  let legs = 0
  let glutes = 0
  for (const { name, sets } of musclesForRows(rows)) {
    if (group(name) !== 'legs') continue
    legs += sets
    if (key(name) === 'glutes') glutes += sets
  }
  return legs > 0 && glutes / legs >= GLUTE_LED ? 'glutes' : 'legs'
}

/**
 * Of the upper-body moves, the share that press — weighted by sets so a single curl finisher
 * doesn't outvote four sets of bench. A move's own push/pull tag wins; a "static" move is sorted
 * by which of its muscles press or pull (lateral raises press, rear-delt flyes pull).
 */
function directionShare(rows: FocusRow[]): number {
  let push = 0
  let pull = 0
  for (const row of rows) {
    const main = mainGroup(row)
    if (!main || !UPPER.includes(main)) continue
    const upperMuscles = row.muscles.filter((m) => {
      const g = group(m.name)
      return g !== undefined && UPPER.includes(g)
    })
    const weight = row.sets ?? 1
    let kind = row.movementType
    if (kind === 'static') {
      const score = upperMuscles.reduce((s, m) => {
        const w = m.primary ? 1 : 0.5
        return s + (PUSH_MUSCLES.has(key(m.name)) ? w : PULL_MUSCLES.has(key(m.name)) ? -w : 0)
      }, 0)
      if (score === 0) continue
      kind = score > 0 ? 'push' : 'pull'
    }
    if (kind === 'push') push += weight
    else pull += weight
  }
  return push + pull === 0 ? 0.5 : push / (push + pull)
}

export const FOCUS_TITLE: Record<DayFocus, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms', legs: 'Legs', glutes: 'Glutes',
  core: 'Core', push: 'Push', pull: 'Pull', upper: 'Upper body', 'full-body': 'Full body',
  // A mixed day claims no body part — and "Today's workout: workout" would read as a typo.
  cardio: 'Cardio', workout: 'Grind',
}

const SLOGANS: Record<DayFocus, string[]> = {
  chest: ['Chest day, best day', 'Built to press', 'Chest first, questions later'],
  back: ['Got your back', 'Back in business', 'Wings loading'],
  shoulders: ['Boulder shoulders', 'Shoulders of steel', 'Carry the weight'],
  arms: ["Sun's out, guns out", 'Welcome to the gun show', 'Flex mode on'],
  legs: ['Never skip leg day', 'Leg day survived', 'Walking is overrated'],
  glutes: ['Booty in progress', 'Glutes & glory', 'Built from the bottom up'],
  core: ['Core of steel', 'Abs are made here', 'Stay tight'],
  push: ['Push past it', 'Pushing limits', 'Push it to the limit'],
  pull: ['Pull your weight', 'Pull harder', 'Pulling through'],
  upper: ['Built up top', 'Top shelf', 'Upper hand'],
  'full-body': ['Full send', 'Head to toe', 'All in'],
  cardio: ['Keep the pace', 'Heart of a champion', 'Run it'],
  workout: ['No pain, no gain', 'Stronger than yesterday', 'Earned, not given', 'Sweat now, shine later'],
}

/**
 * A slogan for the day's focus. Picked by the day's moves, so a day keeps its line every time it
 * is shared, while two chest days with different moves can get different ones.
 */
export function focusSlogan(focus: DayFocus, rows: FocusRow[]): string {
  const seed = rows.map((r) => r.exercise.name).join('|')
  const hash = [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  const options = SLOGANS[focus]
  return options[hash % options.length]!
}

/** Several heads of one muscle read better as the muscle: three chest parts are just "Chest". */
const COLLAPSE: Record<string, string> = {
  'upper chest': 'Chest', 'middle chest': 'Chest', 'lower chest': 'Chest',
  'front shoulder': 'Shoulders', 'side shoulder': 'Shoulders', 'rear shoulder': 'Shoulders',
}

/**
 * The day's muscles to name on the card, busiest first. Chest and shoulder parts fold into
 * "Chest" / "Shoulders" when the day works two or more of them; a lone part keeps its own name
 * ("Rear Shoulder" on a pull day says more than "Shoulders").
 */
export function featuredMuscles(rows: FocusRow[], count: number): string[] {
  const load = musclesForRows(rows)
  const parts = new Map<string, number>()
  for (const { name } of load) {
    const whole = COLLAPSE[key(name)]
    if (whole) parts.set(whole, (parts.get(whole) ?? 0) + 1)
  }
  const names: string[] = []
  for (const { name } of load) {
    const whole = COLLAPSE[key(name)]
    const shown = whole && (parts.get(whole) ?? 0) >= 2 ? whole : name
    if (!names.includes(shown)) names.push(shown)
  }
  return names.slice(0, count)
}
