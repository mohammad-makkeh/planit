import type { CSSProperties } from 'react'
import { Dumbbell } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * An equipment icon (an SVG file from `public/equipment/`, referenced by the equipment
 * catalog's `image_url`) drawn as a CSS mask filled with `currentColor` — so it always matches
 * the text beside it: muted in quiet pills, white on a selected brand pill. The file's own
 * stroke colour is ignored; only its shape counts. Falls back to lucide's dumbbell. Size it
 * with `className` (e.g. `size-4`).
 */
export function EquipmentIcon({ src, className }: { src: string | null | undefined; className?: string }) {
  if (!src) return <Dumbbell className={cn('shrink-0', className)} aria-hidden />
  const mask = `url("${src}") center / contain no-repeat`
  return (
    <span
      aria-hidden
      className={cn('inline-block shrink-0 bg-current', className)}
      style={{ mask, WebkitMask: mask } as CSSProperties}
    />
  )
}
