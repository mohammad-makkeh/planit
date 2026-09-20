'use client'

import { Dumbbell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ExerciseWithTags } from '@/services/exercises'

export function ExerciseCard({
  exercise,
  onClick,
}: {
  exercise: ExerciseWithTags
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors hover:bg-accent/40"
    >
      {exercise.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={exercise.imageUrl} alt={exercise.name} className="size-12 rounded-xl border object-cover" />
      ) : (
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
          <Dumbbell className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{exercise.name}</p>
        {exercise.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
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
