'use client'

import { useState } from 'react'
import { MuscleMap } from '@/components/shared/muscle-map'
import { MuscleSummaryDialog } from '@/components/shared/muscle-summary'
import { shadesForRows, type WorkedRow } from '@/lib/muscle-map'
import type { ExerciseWithDetails } from '@/services/exercises'
import { GapSuggestions } from './gap-suggestions'
import type { PickedExercise } from './plan-editor'

/**
 * Opens the whole plan's muscle balance full-screen. The button itself carries a tiny live
 * figure, so the week's shape is visible without opening anything.
 */
export function WeekBalanceButton({
  title,
  rows,
  catalog,
  exercises,
  days,
  onAdd,
}: {
  title: string
  rows: WorkedRow[]
  catalog: string[]
  exercises: ExerciseWithDetails[]
  days: { id: string; label: string }[]
  onAdd: (dayId: string, exercise: PickedExercise) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Week balance"
        // Figure-only on phones so a long plan title keeps the room; the label joins from `sm`.
        className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-input bg-background px-2.5 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 sm:pr-3 sm:pl-2"
      >
        <MuscleMap shades={shadesForRows(rows)} label="" className="h-6" />
        <span className="hidden sm:inline">Week</span>
      </button>
      <MuscleSummaryDialog
        open={open}
        onOpenChange={setOpen}
        kicker="This week"
        title={title}
        rows={rows}
        catalog={catalog}
        // Suggestions need a day to add to; a plan with no days just shows the gaps.
        renderGapFix={
          days.length > 0
            ? (muscle, back) => (
                <GapSuggestions
                  muscle={muscle}
                  exercises={exercises}
                  days={days}
                  onAdd={onAdd}
                  onBack={back}
                />
              )
            : undefined
        }
      />
    </>
  )
}
