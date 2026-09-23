'use client'

import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { MoveThumbnail } from '@/components/shared/move-thumbnail'
import { cn } from '@/lib/utils'
import type { ExerciseWithDetails } from '@/services/exercises'
import type { PickedExercise } from './plan-editor'

/**
 * The Week view's fix for an untrained muscle: library moves that target it (primary first),
 * then a day to add the chosen one to. Adding goes through the editor's normal `addRow`, so it
 * is a local edit like any other and lands with the next Save.
 */
export function GapSuggestions({
  muscle,
  exercises,
  days,
  onAdd,
  onBack,
}: {
  muscle: string
  exercises: ExerciseWithDetails[]
  days: { id: string; label: string }[]
  onAdd: (dayId: string, exercise: PickedExercise) => void
  onBack: () => void
}) {
  const [pickedId, setPickedId] = useState<string | null>(null)
  const matches = exercises
    .flatMap((e) => {
      const target = e.muscleTargets.find((m) => m.name === muscle)
      return target ? [{ exercise: e, primary: target.primary }] : []
    })
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.exercise.name.localeCompare(b.exercise.name))

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 flex h-9 cursor-pointer items-center gap-1 rounded-full pr-3 pl-1 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ChevronLeft className="size-4" /> Back
      </button>
      <p className="text-sm font-semibold">Moves for {muscle}</p>
      {matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No moves in your library target {muscle} yet. Add one from the Library, then come back.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {matches.map(({ exercise, primary }) => {
            const picked = pickedId === exercise.id
            return (
              <li key={exercise.id} className={cn('rounded-xl border', picked && 'border-brand')}>
                <button
                  type="button"
                  onClick={() => setPickedId(picked ? null : exercise.id)}
                  aria-expanded={picked}
                  className="flex w-full cursor-pointer items-center gap-2.5 p-2 text-left"
                >
                  <MoveThumbnail
                    name={exercise.name}
                    muscles={exercise.muscleTargets}
                    equipmentImageUrl={
                      exercise.equipment.find((eq) => eq.id === exercise.defaultEquipmentId)?.imageUrl ?? null
                    }
                    className="size-10 rounded-lg"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{exercise.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {primary ? 'Primary' : 'Secondary'} for {muscle}
                    </span>
                  </span>
                </button>
                {picked && (
                  <div className="space-y-2 px-2 pb-2.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Add to</p>
                    <div className="flex flex-wrap gap-1.5">
                      {days.map((day) => (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            onAdd(day.id, { id: exercise.id, name: exercise.name })
                            toast.success(`Added ${exercise.name} to ${day.label}`)
                            onBack()
                          }}
                          className="inline-flex h-9 cursor-pointer items-center rounded-full border border-input bg-background px-3.5 text-sm font-medium outline-none hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
