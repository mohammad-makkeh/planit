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
