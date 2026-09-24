import { EquipmentIcon } from '@/components/shared/equipment-icon'
import { cn } from '@/lib/utils'
import type { SharedRow } from '@/services/share'

/**
 * A move's two chips — movement type and the equipment it's done with — as the lightbox and
 * the gym player show them. `md` is the player's slightly larger size.
 */
export function MoveChips({ row, size = 'sm' }: { row: SharedRow; size?: 'sm' | 'md' }) {
  const md = size === 'md'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={cn(
          'inline-flex shrink-0 items-center rounded-full border border-input bg-background font-medium text-muted-foreground',
          md ? 'h-6 px-2.5 text-[11px]' : 'h-5 px-2 text-[10px]',
        )}
      >
        {row.movementType.charAt(0).toUpperCase() + row.movementType.slice(1)}
      </span>
      {row.equipment && (
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full border border-input font-medium text-muted-foreground',
            md ? 'h-6 px-2.5 text-[12px]' : 'px-2 py-0.5 text-[11px]',
          )}
        >
          <EquipmentIcon src={row.equipment.imageUrl} className="size-3.5" />
          {row.equipment.name}
        </span>
      )}
    </div>
  )
}
