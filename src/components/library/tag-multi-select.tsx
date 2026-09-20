'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createTagAction } from '@/actions/tags'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type TagOption = { id: string; name: string }

export function TagMultiSelect({
  options,
  value,
  onChange,
  onCreated,
}: {
  options: TagOption[]
  value: string[]
  onChange: (ids: string[]) => void
  onCreated: (tag: TagOption) => void
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
    const result = await createTagAction({ name })
    setCreating(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    onCreated(result.data)
    onChange([...value, result.data.id])
    setNewName('')
  }

  return (
    <div className="space-y-2">
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
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New tag…"
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
          aria-label="Add tag"
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}
