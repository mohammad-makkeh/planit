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

  // gap-3 + px-4: five 60px circles (a 5×5) fit one row at 390px; six wrap.
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 px-4">
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
