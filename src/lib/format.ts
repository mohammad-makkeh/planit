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

/**
 * A numeric editor field's raw input → an integer, or null when it is empty. Never NaN and
 * never a silent 0: a cleared field must round-trip to SQL NULL, not to zero.
 */
export function parseIntegerInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}
