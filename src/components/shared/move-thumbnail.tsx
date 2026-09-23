import { Dumbbell } from 'lucide-react'
import { shadesForMove, type MuscleWork } from '@/lib/muscle-map'
import { cn } from '@/lib/utils'
import { MuscleMap } from './muscle-map'

/**
 * A move's picture everywhere it appears (library, editor, share page): the coach's uploaded
 * image if there is one, otherwise the body figure of the muscles it works, otherwise the
 * equipment icon — the last only for moves with no muscle targets yet. Size and radius come
 * from `className` (e.g. `size-11 rounded-lg`).
 */
export function MoveThumbnail({
  name,
  imageUrl,
  muscles,
  equipmentImageUrl,
  className,
}: {
  name: string
  imageUrl: string | null
  muscles: MuscleWork[]
  equipmentImageUrl: string | null
  className?: string
}) {
  const frame = cn('shrink-0 overflow-hidden border', className)

  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={name} className={cn(frame, 'object-cover')} />
  }
  if (muscles.length > 0) {
    return (
      <div className={cn(frame, 'flex items-center justify-center bg-muted/40 p-1')}>
        <MuscleMap
          shades={shadesForMove(muscles)}
          label={`${name}: works ${muscles.map((m) => m.name).join(', ')}`}
          single
          // Both axes explicit: a bare `h-full` inside the flex frame resolves to 0.
          className="size-full justify-center"
        />
      </div>
    )
  }
  if (equipmentImageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={equipmentImageUrl} alt={name} className={cn(frame, 'object-cover')} />
  }
  return (
    <div className={cn(frame, 'flex items-center justify-center border-transparent bg-muted')}>
      <Dumbbell className="size-1/2 max-h-5 max-w-5 text-muted-foreground" />
    </div>
  )
}
