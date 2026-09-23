'use client'

import { cn } from '@/lib/utils'
import type { CatalogOption } from './catalog-picker-field'

function chipClass(active: boolean): string {
  return cn(
    'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30',
    active
      ? 'border-transparent bg-brand text-brand-foreground'
      : 'border-input bg-background text-foreground hover:bg-accent',
  )
}

export function MuscleFilter({
  muscles,
  selected,
  onSelect,
}: {
  muscles: CatalogOption[]
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
      <button type="button" className={chipClass(selected === null)} onClick={() => onSelect(null)}>
        All
      </button>
      {muscles.map((muscle) => (
        <button
          key={muscle.id}
          type="button"
          className={chipClass(selected === muscle.id)}
          onClick={() => onSelect(muscle.id === selected ? null : muscle.id)}
        >
          {muscle.name}
        </button>
      ))}
    </div>
  )
}
