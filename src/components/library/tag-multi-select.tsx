'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type TagOption = { id: string; name: string }

export function TagMultiSelect({
  options,
  value,
  onChange,
}: {
  options: TagOption[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((tag) => (
        <button key={tag.id} type="button" onClick={() => toggle(tag.id)}>
          <Badge
            variant={value.includes(tag.id) ? 'default' : 'outline'}
            className={cn(value.includes(tag.id) && 'bg-brand text-brand-foreground')}
          >
            {tag.name}
          </Badge>
        </button>
      ))}
    </div>
  )
}
