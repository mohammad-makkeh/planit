'use client'

import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { MoveThumbnail } from '@/components/shared/move-thumbnail'
import { DialogSheet } from '@/components/ui/dialog-sheet'
import { setCount, setsDone, type GymState } from '@/lib/gym-mode'
import { cn } from '@/lib/utils'
import type { SharedSession } from '@/services/share'

/**
 * The day's moves with their progress, to jump anywhere — the bench is taken, do the free
 * machine first. A nested Base UI dialog, because the player itself is one.
 */
export function MoveListSheet({
  open,
  onOpenChange,
  session,
  state,
  onPick,
  className,
  style,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: SharedSession
  state: GymState
  onPick: (move: number) => void
  className?: string
  style?: CSSProperties
}) {
  return (
    <DialogSheet open={open} onOpenChange={onOpenChange} title={session.label} className={className} style={style}>
      <ul className="space-y-1.5">
        {session.rows.map((row, i) => {
          const total = setCount(row)
          const done = setsDone(state, i)
          const complete = done === total
          const current = i === state.move
          return (
            <li key={i}>
              <button
                type="button"
                aria-current={current || undefined}
                onClick={() => onPick(i)}
                className={cn(
                  'flex w-full touch-manipulation items-center gap-3 rounded-xl p-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand/50',
                  current && 'bg-brand/10',
                )}
              >
                <MoveThumbnail
                  name={row.exercise.name}
                  muscles={row.muscles}
                  equipmentImageUrl={row.equipment?.imageUrl ?? null}
                  className="size-10 rounded-lg"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.exercise.name}</span>
                {complete ? (
                  <Check className="size-5 shrink-0 text-brand" aria-label="Complete" />
                ) : (
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    {done} / {total}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </DialogSheet>
  )
}
