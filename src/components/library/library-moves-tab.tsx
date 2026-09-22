'use client'

import { useMemo, useState } from 'react'
import { Dumbbell, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { movementTypes, type MovementType } from '@/lib/validation'
import { EmptyState } from '@/components/shell/empty-state'
import { Fab } from '@/components/shell/fab'
import { Input } from '@/components/ui/input'
import type { ExerciseWithTags } from '@/services/exercises'
import type { EquipmentOption } from './equipment-multi-select'
import { ExerciseCard } from './exercise-card'
import { ExerciseFormSheet } from './exercise-form-sheet'
import type { TagOption } from './tag-multi-select'

function chipClass(active: boolean): string {
  return cn(
    'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30',
    active
      ? 'border-transparent bg-brand text-brand-foreground'
      : 'border-input bg-background text-foreground hover:bg-accent',
  )
}

export function LibraryMovesTab({
  exercises,
  tags,
  equipmentOptions,
}: {
  exercises: ExerciseWithTags[]
  tags: TagOption[]
  equipmentOptions: EquipmentOption[]
}) {
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<MovementType[]>([])
  const [editing, setEditing] = useState<ExerciseWithTags | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  function toggleType(type: MovementType) {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  function toggleTag(id: string) {
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }

  const allActive = selectedTypes.length === 0 && selectedTags.length === 0

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return exercises.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false
      if (selectedTypes.length && !selectedTypes.includes(e.movementType)) return false
      if (selectedTags.length && !e.tags.some((t) => selectedTags.includes(t.id))) return false
      return true
    })
  }, [exercises, search, selectedTags, selectedTypes])

  return (
    <div className="space-y-3 pt-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search moves…"
          className="pl-9"
          inputMode="search"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
        <button
          type="button"
          className={chipClass(allActive)}
          onClick={() => {
            setSelectedTypes([])
            setSelectedTags([])
          }}
        >
          All
        </button>
        {movementTypes.map((type) => (
          <button
            key={type}
            type="button"
            className={chipClass(selectedTypes.includes(type))}
            onClick={() => toggleType(type)}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={chipClass(selectedTags.includes(tag.id))}
            onClick={() => toggleTag(tag.id)}
          >
            {tag.name}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="size-8 text-muted-foreground" />}
          title={exercises.length === 0 ? 'No moves yet' : 'No moves match'}
          description={exercises.length === 0 ? 'Add your first move.' : 'Try another search or tag.'}
        />
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((exercise) => (
            <ExerciseCard key={exercise.id} exercise={exercise} onClick={() => setEditing(exercise)} />
          ))}
        </div>
      )}
      <Fab label="New move" onClick={() => setCreateOpen(true)} />
      <ExerciseFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        tagOptions={tags}
        equipmentOptions={equipmentOptions}
      />
      {editing && (
        <ExerciseFormSheet
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          exercise={editing}
          tagOptions={tags}
          equipmentOptions={equipmentOptions}
        />
      )}
    </div>
  )
}
