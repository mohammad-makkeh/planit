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
      {options.map((item) => (
        <button key={item.id} type="button" onClick={() => toggle(item.id)}>
          <Badge
            variant={value.includes(item.id) ? 'default' : 'outline'}
            className={cn(value.includes(item.id) && 'bg-brand text-brand-foreground')}
          >
            {item.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" className="size-4 shrink-0 rounded-sm object-cover" />
            )}
            {item.name}
          </Badge>
        </button>
      ))}
    </div>
  )
}
