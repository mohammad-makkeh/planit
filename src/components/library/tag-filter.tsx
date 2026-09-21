'use client'

import { cn } from '@/lib/utils'
import type { TagOption } from './tag-multi-select'

function chipClass(active: boolean): string {
  return cn(
    'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors',
    active
      ? 'border-transparent bg-brand text-brand-foreground'
      : 'border-input bg-background text-foreground hover:bg-accent',
  )
}

export function TagFilter({
  tags,
  selected,
  onSelect,
}: {
  tags: TagOption[]
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
      <button type="button" className={chipClass(selected === null)} onClick={() => onSelect(null)}>
        All
      </button>
      {tags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          className={chipClass(selected === tag.id)}
          onClick={() => onSelect(tag.id === selected ? null : tag.id)}
        >
          {tag.name}
        </button>
      ))}
    </div>
  )
}
