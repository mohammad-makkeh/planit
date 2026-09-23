'use client'

import { Dumbbell } from 'lucide-react'
import { MoveThumbnail } from '@/components/shared/move-thumbnail'
import type { SharedRow } from '@/services/share'

// Same field order and units as the editor (`exercise-row-card.tsx`) and the PDF
// (`plan-pdf.tsx`'s `COL` + `Workout`): Sets · Reps · Rest · Speed · 1RM, rest in `sec`.
const FIELDS = [
  { key: 'sets', label: 'Sets', suffix: '' },
  { key: 'reps', label: 'Reps', suffix: '' },
  { key: 'rest', label: 'Rest', suffix: 'sec' },
  { key: 'speed', label: 'Speed', suffix: '' },
  { key: 'oneRm', label: '1RM', suffix: '%' },
] as const

export function ShareRowCard({ row, onOpen }: { row: SharedRow; onOpen: () => void }) {
  // `!== null` rather than truthiness — rest is an integer and 0 is a real value.
  const values = FIELDS.filter(({ key }) => row[key] !== null && row[key] !== '')

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full space-y-2.5 rounded-2xl border bg-card p-3 text-left transition-colors hover:bg-accent/40"
    >
      <div className="flex items-center gap-2.5">
        <MoveThumbnail
          name={row.exercise.name}
          imageUrl={row.exercise.imageUrl}
          muscles={row.muscles}
          equipmentImageUrl={row.equipment?.imageUrl ?? null}
          className="size-11 rounded-lg"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold">{row.exercise.name}</p>
          <div className="flex flex-wrap items-center gap-1">
            <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-input bg-background px-2 text-[10px] font-medium text-muted-foreground">
              {row.movementType.charAt(0).toUpperCase() + row.movementType.slice(1)}
            </span>
            {row.equipment && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-input px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {row.equipment.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.equipment.imageUrl}
                    alt=""
                    className="size-3.5 shrink-0 rounded-sm object-cover"
                  />
                ) : (
                  <Dumbbell className="size-3.5 shrink-0" />
                )}
                <span className="max-w-24 truncate">{row.equipment.name}</span>
              </span>
            )}
          </div>
        </div>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t pt-2">
          {values.map(({ key, label, suffix }) => (
            <div key={key} className="min-w-10">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className="text-sm font-semibold">
                {/* Same spacing rule as the PDF's `cell()`: a space before the unit, except `%`. */}
                {suffix ? `${row[key]} ${suffix}`.replace(' %', '%') : row[key]}
              </p>
            </div>
          ))}
        </div>
      )}
      {row.note && <p className="text-xs text-muted-foreground">{row.note}</p>}
    </button>
  )
}
