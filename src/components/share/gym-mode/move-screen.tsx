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
