import {
  BACK_BODY, BODY_VIEWBOX, FRONT_BODY, busiestSide, focusViewBox, shadeOpacity,
  type RegionShades, type RegionShape,
} from '@/lib/muscle-map'
import { cn } from '@/lib/utils'

function Figure({
  shapes,
  shades,
  viewBox = BODY_VIEWBOX,
  className = 'h-full w-auto',
}: {
  shapes: RegionShape[]
  shades: RegionShades
  viewBox?: string
  className?: string
}) {
  return (
    <svg viewBox={viewBox} className={className} aria-hidden>
      {shapes.map(({ region, points }) => {
        const shade = shades[region]
        return points.map((p, i) => (
          <polygon
            key={`${region}-${i}`}
            points={p}
            // `--brand` is the coach's colour on the share page and the app's everywhere else.
            fill={shade === undefined ? 'var(--color-muted-foreground)' : 'var(--brand)'}
            fillOpacity={shade === undefined ? 0.26 : shadeOpacity(shade)}
          />
        ))
      })}
    </svg>
  )
}

/** An empty label marks the figure decorative (e.g. inside a button that names itself). */
function a11y(label: string) {
  return label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
}

/**
 * Front and back body figures with the worked regions filled in the brand colour. Size it by
 * height (e.g. `h-12`); the figures keep their proportions. `label` is the accessible name —
 * list the muscles, since colour alone carries the meaning here.
 */
export function MuscleMap({
  shades,
  label,
  captions = false,
  single = false,
  className,
}: {
  shades: RegionShades
  label: string
  /** Show "Front" / "Back" under each figure — for large views. */
  captions?: boolean
  /** One side only, cropped to the worked muscles — for small square thumbnails. */
  single?: boolean
  className?: string
}) {
  if (single) {
    const shapes = busiestSide(shades) === 'back' ? BACK_BODY : FRONT_BODY
    return (
      <div {...a11y(label)} className={cn('flex shrink-0 items-center', className)}>
        <Figure
          shapes={shapes}
          shades={shades}
          viewBox={focusViewBox(shapes, shades)}
          className="size-full"
        />
      </div>
    )
  }
  if (!captions) {
    return (
      <div {...a11y(label)} className={cn('flex shrink-0 items-center gap-[6%]', className)}>
        <Figure shapes={FRONT_BODY} shades={shades} />
        <Figure shapes={BACK_BODY} shades={shades} />
      </div>
    )
  }
  return (
    <div {...a11y(label)} className={cn('flex w-full items-stretch gap-4', className)}>
      {[
        { caption: 'Front', shapes: FRONT_BODY },
        { caption: 'Back', shapes: BACK_BODY },
      ].map(({ caption, shapes }) => (
        <div key={caption} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          {/* The svg fills this box and letterboxes itself (preserveAspectRatio "meet"), so the
              figure is bounded by whichever of its half-width or the height runs out first. */}
          <div className="min-h-0 w-full flex-1">
            <Figure shapes={shapes} shades={shades} className="size-full" />
          </div>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground" aria-hidden>
            {caption}
          </span>
        </div>
      ))}
    </div>
  )
}
