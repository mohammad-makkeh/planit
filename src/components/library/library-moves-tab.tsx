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
import { TagFilter } from './tag-filter'
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
  const [tagId, setTagId] = useState<string | null>(null)
  const [movementType, setMovementType] = useState<MovementType | null>(null)
  const [editing, setEditing] = useState<ExerciseWithTags | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return exercises.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false
      if (tagId && !e.tags.some((t) => t.id === tagId)) return false
      if (movementType && e.movementType !== movementType) return false
      return true
    })
  }, [exercises, search, tagId, movementType])

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
        <button type="button" className={chipClass(movementType === null)} onClick={() => setMovementType(null)}>
          All
        </button>
        {movementTypes.map((type) => (
          <button
            key={type}
            type="button"
            className={chipClass(movementType === type)}
            onClick={() => setMovementType(movementType === type ? null : type)}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>
      <TagFilter tags={tags} selected={tagId} onSelect={setTagId} />
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
