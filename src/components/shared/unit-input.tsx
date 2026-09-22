import { Input } from '@/components/ui/input'
import { parseIntegerInput } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * A numeric editor field with an optional hard-placed unit suffix (min, BPM, %, sec, …).
 * Wraps `ui/input` with `type="number"`, hides native spinners (the app's own steppers/units
 * are the affordance), and round-trips an empty field to `null` via `parseIntegerInput` —
 * never `NaN`, never a silent `0`.
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
        aria-label={label}
        className={cn(
          '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          inputClassName,
          unit && 'pr-10',
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
