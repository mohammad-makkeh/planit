'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createEquipmentAction } from '@/actions/equipment'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type EquipmentOption = { id: string; name: string; imageUrl: string | null; isFallback: boolean }

export function EquipmentMultiSelect({
  options,
  value,
  onChange,
  onCreated,
}: {
  options: EquipmentOption[]
  value: string[]
  onChange: (ids: string[]) => void
  onCreated: (equipment: EquipmentOption) => void
}) {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  async function create() {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    const result = await createEquipmentAction({ name })
    setCreating(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    const created: EquipmentOption = { id: result.data.id, name, imageUrl: null, isFallback: false }
    onCreated(created)
    onChange([...value, created.id])
    setNewName('')
  }

  return (
    <div className="space-y-2">
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
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New equipment…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void create()
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => void create()}
          disabled={creating || !newName.trim()}
          aria-label="Add equipment"
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}
