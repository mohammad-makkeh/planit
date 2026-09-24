'use client'

import { Flame } from 'lucide-react'
import { MuscleMap } from '@/components/shared/muscle-map'
import { Button } from '@/components/ui/button'
import { formatSummary, summary, type GymState } from '@/lib/gym-mode'
import { musclesForRows, shadesForRows } from '@/lib/muscle-map'
import type { SharedSession } from '@/services/share'

/**
 * After the last move: the day's shaded figure, what was done, and the two ways out — Flex it
 * (post a story card; the player closes first, the story sheet opens on the page) or Done.
 * Both clear the saved progress.
 */
export function FinishScreen({
  headline,
  session,
  state,
  onDone,
  onFlexIt,
}: {
  headline: string
  session: SharedSession
  state: GymState
  onDone: () => void
  onFlexIt: () => void
}) {
  const worked = musclesForRows(session.rows).map((m) => m.name).join(', ')

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:pt-6 sm:pb-6">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 text-center">
        <MuscleMap
          shades={shadesForRows(session.rows)}
          label={worked ? `Today you worked ${worked}` : "Today's workout"}
          className="h-[min(34dvh,18rem)] justify-center"
        />
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand">Workout done</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-balance">{headline}</h2>
          <p className="text-[15px] font-medium text-muted-foreground tabular-nums">{formatSummary(summary(state))}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-6">
        <Button
          onClick={onFlexIt}
          className="h-12 w-full rounded-2xl bg-brand text-base font-semibold text-brand-foreground hover:bg-brand/90"
        >
          <Flame className="size-4" aria-hidden />
          Flex it
        </Button>
        <Button variant="outline" onClick={onDone} className="h-12 w-full rounded-2xl text-base font-semibold">
          Done
        </Button>
      </div>
    </div>
  )
}
