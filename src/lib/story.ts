/** The story card designs a client picks from, in picker order. They have no user-facing names. */
export const STORY_DESIGNS = [{ id: 'chart' }, { id: 'tape' }, { id: 'cover' }] as const

export type StoryDesign = (typeof STORY_DESIGNS)[number]['id']

export function isStoryDesign(value: string): value is StoryDesign {
  return STORY_DESIGNS.some((d) => d.id === value)
}

/** The phone's local date as `YYYY-MM-DD` — "today" is the client's, not the server's. */
export function localDateParam(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** `2026-09-24` → "SEP 24". Anything malformed falls back to `fallback`'s UTC date. */
export function storyDateLabel(param: string | null, fallback = new Date()): string {
  const match = param?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const month = match ? Number(match[2]) : fallback.getUTCMonth() + 1
  const day = match ? Number(match[3]) : fallback.getUTCDate()
  if (month < 1 || month > 12 || day < 1 || day > 31) return storyDateLabel(null, fallback)
  return `${MONTHS[month - 1]} ${day}`
}
