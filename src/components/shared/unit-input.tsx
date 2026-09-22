import { Input } from '@/components/ui/input'
import { parseIntegerInput } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * A numeric editor field with an optional hard-placed unit suffix (min, BPM, %, sec, …).
 * Wraps `ui/input` with `type="number"`, hides native spinners (the app's own steppers/units
 * are the affordance), and round-trips an empty field to `null` via `parseIntegerInput` —
 * never `NaN`, never a silent `0`.
 *
 * `min`/`max` on `type="number"` are advisory only — nothing here is a submitted `<form>`, so
 * browser constraint validation never runs. This component is the one place that enforces them:
 * on blur (not per keystroke, which would make typing "50" impossible when max is 15) it clamps
 * the current value into `[min, max]` whenever both are supplied, and propagates the clamped
 * value via `onChange` so every consumer inherits the same behavior.
 */
export function UnitInput({
  value,
  onChange,
  unit,
  min,
  max,
  label,
  className,
  inputClassName,
  unitClassName,
  id,
}: {
  value: number | null
  onChange: (value: number | null) => void
  unit?: string
  min?: number
  max?: number
  label: string
  className?: string
  /** Extra classes for the underlying input (e.g. sizing for a compact grid). */
  inputClassName?: string
  /** Extra classes for the unit suffix label. */
  unitClassName?: string
  id?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value ?? ''}
        onChange={(e) => onChange(parseIntegerInput(e.target.value))}
        onBlur={() => {
          if (value === null || min === undefined || max === undefined) return
          const clamped = Math.min(max, Math.max(min, value))
          if (clamped !== value) onChange(clamped)
        }}
        aria-label={label}
        className={cn(
          '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          unit && 'pr-10',
          inputClassName,
        )}
      />
      {unit ? (
        <span
          className={cn(
            'pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground',
            unitClassName,
          )}
        >
          {unit}
        </span>
      ) : null}
    </div>
  )
}
