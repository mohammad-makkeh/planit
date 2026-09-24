'use client'

import { MuscleMap } from '@/components/shared/muscle-map'
import { EquipmentIcon } from '@/components/shared/equipment-icon'
import { MusclePill } from '@/components/shared/muscle-pill'
import { Button } from '@/components/ui/button'
import { shadesForMove } from '@/lib/muscle-map'
import type { SharedRow } from '@/services/share'
import { MoveChips } from './move-chips'

/**
 * Everything the share page knows about one move: the body figure (or the equipment icon for a
 * move with no muscle targets), its chips, the muscles it works and the tutorial link. The share
 * page shows it in a vaul sheet (`MoveLightbox`); the gym player shows it in a `DialogSheet`.
 */
export function MoveDetails({ row }: { row: SharedRow }) {
  // Same precedence as `MoveThumbnail`: the body figure, else the equipment icon.
  const showBodyHero = row.muscles.length > 0

  return (
    <div className="space-y-4">
      {showBodyHero ? (
        <div className="flex h-[min(40dvh,20rem)] items-center justify-center rounded-xl border bg-muted/40 p-5">
          <MuscleMap
            shades={shadesForMove(row.muscles)}
            label={`Muscles worked: ${row.muscles.map((m) => m.name).join(', ')}`}
            className="size-full justify-center"
          />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border bg-muted/40 text-muted-foreground">
          <EquipmentIcon src={row.equipment?.imageUrl ?? null} className="size-16" />
        </div>
      )}
      <MoveChips row={row} />
      {row.muscles.length > 0 && (
        <div className="space-y-1.5 rounded-xl border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Works</p>
          <div className="flex flex-wrap gap-1.5">
            {row.muscles.map((m) => (
              <MusclePill key={m.name} name={m.name} primary={m.primary} />
            ))}
          </div>
        </div>
      )}
      {row.exercise.tutorialUrl && (
        <Button
          size="lg"
          className="h-11 w-full bg-brand text-brand-foreground hover:bg-brand/90"
          nativeButton={false}
          render={<a href={row.exercise.tutorialUrl} target="_blank" rel="noopener noreferrer" />}
        >
          Watch tutorial
        </Button>
      )}
    </div>
  )
}
