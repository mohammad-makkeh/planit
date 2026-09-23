'use client'

import { cn } from '@/lib/utils'
import { MoveThumbnail } from '@/components/shared/move-thumbnail'
import { Badge } from '@/components/ui/badge'
import type { ExerciseWithDetails } from '@/services/exercises'

export function ExerciseCard({
  exercise,
  onClick,
}: {
  exercise: ExerciseWithDetails
  onClick: () => void
}) {
  const defaultEquipment = exercise.equipment.find((eq) => eq.id === exercise.defaultEquipmentId)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors hover:bg-accent/40"
    >
      <MoveThumbnail
        name={exercise.name}
        muscles={exercise.muscleTargets}
        equipmentImageUrl={defaultEquipment?.imageUrl ?? null}
        className="size-12 rounded-xl"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{exercise.name}</p>
        {(exercise.muscleTargets.length > 0 || exercise.movementType) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {exercise.movementType && (
              <div
                className={cn(
                  'inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[10px] font-medium',
                  'border-input bg-background text-muted-foreground',
                )}
              >
                {exercise.movementType.charAt(0).toUpperCase() + exercise.movementType.slice(1)}
              </div>
            )}
            {exercise.muscleTargets.map((m) => (
              <Badge
                key={m.id}
                variant={m.primary ? 'secondary' : 'outline'}
                className={cn('px-1.5 py-0 text-[10px]', !m.primary && 'text-muted-foreground')}
              >
                {m.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}
