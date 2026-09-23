import { BACK_BODY, BODY_VIEWBOX, FRONT_BODY, type BodyRegion, type RegionShape } from './regions'

export { BACK_BODY, BODY_VIEWBOX, FRONT_BODY, type BodyRegion, type RegionShape } from './regions'

/**
 * Which drawn regions each catalog muscle target lights up. Keyed by lowercased name because the
 * catalog is edited in the database — a renamed or new muscle simply draws nothing until it is
 * added here. The outlines have no upper/middle/lower chest or side-delt split, so those share
 * the nearest drawn region.
 */
const REGIONS_BY_MUSCLE: Record<string, BodyRegion[]> = {
  'upper chest': ['chest'],
  'middle chest': ['chest'],
  'lower chest': ['chest'],
  lats: ['upper-back'],
  'upper back': ['trapezius'],
  'lower back': ['lower-back'],
  'front shoulder': ['front-deltoids'],
  'side shoulder': ['front-deltoids', 'back-deltoids'],
  'rear shoulder': ['back-deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  abs: ['abs'],
  obliques: ['obliques'],
  glutes: ['gluteal'],
  quads: ['quadriceps'],
  hamstrings: ['hamstring'],
  calves: ['calves', 'left-soleus', 'right-soleus'],
}

/** Region → shade in (0, 1]; regions absent from the map stay the plain body colour. */
export type RegionShades = Partial<Record<BodyRegion, number>>

/** A muscle a move targets. Secondary muscles assist: lighter on the figure, half the volume. */
export type MuscleWork = { name: string; primary: boolean }

/** How strongly a secondary muscle draws on a single move's figure. */
const SECONDARY_SHADE = 0.35
/** Share of a row's sets credited to a muscle it only works secondarily. */
const SECONDARY_VOLUME = 0.5

function regionsFor(muscleName: string): BodyRegion[] {
  return REGIONS_BY_MUSCLE[muscleName.trim().toLowerCase()] ?? []
}

/** One move: primary regions at full strength, secondary ones lighter. */
export function shadesForMove(muscles: MuscleWork[]): RegionShades {
  const shades: RegionShades = {}
  for (const muscle of muscles) {
    const shade = muscle.primary ? 1 : SECONDARY_SHADE
    for (const region of regionsFor(muscle.name)) shades[region] = Math.max(shades[region] ?? 0, shade)
  }
  return shades
}

export type WorkedRow = { muscles: MuscleWork[]; sets: number | null }

function volume(row: WorkedRow, muscle: MuscleWork): number {
  return (row.sets ?? 1) * (muscle.primary ? 1 : SECONDARY_VOLUME)
}

/**
 * Several rows (a day, a week): each region is weighted by the sets that hit it — a row with no
 * sets counts as one, a secondary muscle as half — then scaled against the most-worked region so
 * the busiest area is always full strength. Within one row a region counts once, at its
 * strongest (e.g. a primary front delt beats the same move's secondary side delt).
 */
export function shadesForRows(rows: WorkedRow[]): RegionShades {
  const load = new Map<BodyRegion, number>()
  for (const row of rows) {
    const rowLoad = new Map<BodyRegion, number>()
    for (const muscle of row.muscles) {
      for (const region of regionsFor(muscle.name)) {
        rowLoad.set(region, Math.max(rowLoad.get(region) ?? 0, volume(row, muscle)))
      }
    }
    for (const [region, value] of rowLoad) load.set(region, (load.get(region) ?? 0) + value)
  }
  const max = Math.max(0, ...load.values())
  const shades: RegionShades = {}
  if (max === 0) return shades
  for (const [region, value] of load) shades[region] = value / max
  return shades
}

/**
 * Muscles the rows work with their volume in sets (weighted as above), busiest first. Used as
 * the text alongside the figure so the map is never the only way to read it.
 */
export function musclesForRows(rows: WorkedRow[]): { name: string; sets: number }[] {
  const load = new Map<string, number>()
  for (const row of rows) {
    const seen = new Map<string, number>()
    for (const muscle of row.muscles) {
      seen.set(muscle.name, Math.max(seen.get(muscle.name) ?? 0, volume(row, muscle)))
    }
    for (const [name, value] of seen) load.set(name, (load.get(name) ?? 0) + value)
  }
  return [...load.entries()].sort((a, b) => b[1] - a[1]).map(([name, sets]) => ({ name, sets }))
}

/** "1 set", "4 sets", "7.5 sets" — secondary work makes half sets possible. */
export function formatSets(sets: number): string {
  const rounded = Math.round(sets * 2) / 2
  return `${rounded} ${rounded === 1 ? 'set' : 'sets'}`
}

/** Worked regions never drop below this opacity, so a lightly-hit muscle is still visible. */
export const MIN_SHADE_OPACITY = 0.3

export function shadeOpacity(shade: number): number {
  return MIN_SHADE_OPACITY + (1 - MIN_SHADE_OPACITY) * shade
}

function workedOn(shapes: RegionShape[], shades: RegionShades): number {
  return shapes.reduce((sum, { region }) => sum + (shades[region] ?? 0), 0)
}

/** The side that shows more of the work — front wins ties. For single-figure thumbnails. */
export function busiestSide(shades: RegionShades): 'front' | 'back' {
  return workedOn(BACK_BODY, shades) > workedOn(FRONT_BODY, shades) ? 'back' : 'front'
}

/**
 * A square viewBox framing the worked regions of one side, padded so the surrounding body still
 * reads, and never smaller than `MIN_FOCUS` so a single small muscle isn't blown up past
 * recognition. Falls back to the whole figure when nothing on that side is worked.
 */
const MIN_FOCUS = 70

export function focusViewBox(shapes: RegionShape[], shades: RegionShades): string {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const { region, points } of shapes) {
    if (shades[region] === undefined) continue
    for (const polygon of points) {
      const values = polygon.trim().split(/\s+/).map(Number)
      for (let i = 0; i + 1 < values.length; i += 2) {
        const x = values[i]!
        const y = values[i + 1]!
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
  }
  if (minX === Infinity) return BODY_VIEWBOX
  const size = Math.min(100, Math.max(MIN_FOCUS, (maxX - minX) * 1.3, (maxY - minY) * 1.3))
  const x = Math.min(100 - size, Math.max(0, (minX + maxX) / 2 - size / 2))
  const y = Math.min(200 - size, Math.max(0, (minY + maxY) / 2 - size / 2))
  return `${x.toFixed(1)} ${y.toFixed(1)} ${size.toFixed(1)} ${size.toFixed(1)}`
}
