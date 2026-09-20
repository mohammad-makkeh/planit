'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TagOption } from './tag-multi-select'

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
    <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
      <button type="button" onClick={() => onSelect(null)}>
        <Badge
          variant={selected === null ? 'default' : 'outline'}
          className={cn('whitespace-nowrap', selected === null && 'bg-brand text-brand-foreground')}
        >
          All
        </Badge>
      </button>
      {tags.map((tag) => (
        <button key={tag.id} type="button" onClick={() => onSelect(tag.id === selected ? null : tag.id)}>
          <Badge
            variant={selected === tag.id ? 'default' : 'outline'}
            className={cn('whitespace-nowrap', selected === tag.id && 'bg-brand text-brand-foreground')}
          >
            {tag.name}
          </Badge>
        </button>
      ))}
    </div>
  )
}
