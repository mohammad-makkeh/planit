'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type EquipmentOption = { id: string; name: string; imageUrl: string | null; isFallback: boolean }

export function EquipmentMultiSelect({
  options,
  value,
  onChange,
}: {
  options: EquipmentOption[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((item) => {
        const selected = value.includes(item.id)
        return (
          <button key={item.id} type="button" onClick={() => toggle(item.id)}>
            <Badge
              variant={selected ? 'default' : 'outline'}
              className={cn(selected && 'bg-brand text-brand-foreground')}
            >
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  // The icons are SVG files with a fixed dark stroke, so a filter is the only
                  // way to turn them white alongside the text on the brand background.
                  className={cn('size-4 shrink-0 rounded-sm object-cover', selected && 'brightness-0 invert')}
                />
              )}
              {item.name}
            </Badge>
          </button>
        )
      })}
    </div>
  )
}
