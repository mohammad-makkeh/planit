'use client'

import { Dumbbell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { ExerciseWithTags } from '@/services/exercises'

function moveThumbnail(e: ExerciseWithTags): string | null {
  if (e.imageUrl) return e.imageUrl
  return e.equipment.find((eq) => eq.id === e.defaultEquipmentId)?.imageUrl ?? null
}

export function ExerciseCard({
  exercise,
  onClick,
}: {
  exercise: ExerciseWithTags
  onClick: () => void
}) {
  const thumb = moveThumbnail(exercise)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors hover:bg-accent/40"
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt={exercise.name} className="size-12 rounded-xl border object-cover" />
      ) : (
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
          <Dumbbell className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{exercise.name}</p>
        {(exercise.tags.length > 0 || exercise.movementType) && (
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
            {exercise.tags.map((t) => (
              <Badge key={t.id} variant="secondary" className="px-1.5 py-0 text-[10px]">
                {t.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}
