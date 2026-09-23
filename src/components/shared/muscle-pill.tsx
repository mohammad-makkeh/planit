import { cn } from '@/lib/utils'

/** A muscle name chip: brand-tinted when primary, quiet outline when secondary. */
export function MusclePill({ name, primary = true }: { name: string; primary?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium',
        primary ? 'bg-brand/10 text-brand' : 'border border-input text-muted-foreground',
      )}
    >
      {name}
    </span>
  )
}
