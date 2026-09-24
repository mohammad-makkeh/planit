import { EquipmentIcon } from '@/components/shared/equipment-icon'
import { MuscleMap } from '@/components/shared/muscle-map'
import { shadesForMove } from '@/lib/muscle-map'
import type { SharedRow } from '@/services/share'

/**
 * The hero picture of a move in the player: the focus-cropped single body figure (the same
 * framing as `MoveThumbnail`, just large), or the equipment icon for a move with no muscle
 * targets. Fills whatever box it's given — give the box both dimensions.
 */
export function MoveFigure({ row }: { row: SharedRow }) {
  if (row.muscles.length > 0) {
    return (
      <MuscleMap
        shades={shadesForMove(row.muscles)}
        label={`${row.exercise.name}: works ${row.muscles.map((m) => m.name).join(', ')}`}
        single
        className="size-full justify-center"
      />
    )
  }
  return (
    <div role="img" aria-label={row.exercise.name} className="flex size-full items-center justify-center text-muted-foreground">
      <EquipmentIcon src={row.equipment?.imageUrl ?? null} className="size-24" />
    </div>
  )
}
