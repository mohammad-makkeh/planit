'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, Plus, Search } from 'lucide-react'
import { ExerciseFormSheet } from '@/components/library/exercise-form-sheet'
import { TagFilter } from '@/components/library/tag-filter'
import type { TagOption } from '@/components/library/tag-multi-select'
import { Input } from '@/components/ui/input'
import type { ExerciseWithTags } from '@/services/exercises'
import {
  BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle,
} from '@/components/ui/bottom-sheet'
import type { PickedExercise } from './plan-editor'

export function ExercisePickerSheet({
  open,
  onOpenChange,
  exercises,
  tags,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercises: ExerciseWithTags[]
  tags: TagOption[]
  onPick: (exercise: PickedExercise) => void
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [tagId, setTagId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return exercises.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false
      if (tagId && !e.tags.some((t) => t.id === tagId)) return false
      return true
    })
  }, [exercises, search, tagId])

  const exactMatch = exercises.some((e) => e.name.toLowerCase() === search.trim().toLowerCase())

  function pick(exercise: PickedExercise) {
    onPick(exercise)
    setSearch('')
    setTagId(null)
    onOpenChange(false)
  }

  return (
    <>
      <BottomSheet open={open} onOpenChange={onOpenChange}>
        <BottomSheetContent className="h-[85dvh]">
          <BottomSheetHeader>
            <BottomSheetTitle>Add move</BottomSheetTitle>
          </BottomSheetHeader>
          <div className="space-y-3">
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
            <TagFilter tags={tags} selected={tagId} onSelect={setTagId} />
            {search.trim() !== '' && !exactMatch && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-brand/50 p-3 text-left text-sm font-medium text-brand hover:bg-brand/5"
              >
                <Plus className="size-4" /> Create “{search.trim()}” as a new move
              </button>
            )}
            <div className="space-y-1.5">
              {filtered.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => pick({ id: e.id, name: e.name, imageUrl: e.imageUrl })}
                  className="flex w-full items-center gap-3 rounded-xl border bg-card p-2.5 text-left hover:bg-accent/40"
                >
                  {e.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.imageUrl} alt={e.name} className="size-10 rounded-lg border object-cover" />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <Dumbbell className="size-4 text-muted-foreground" />
                    </div>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.name}</span>
                </button>
              ))}
              {filtered.length === 0 && search.trim() === '' && (
                <p className="p-4 text-center text-sm text-muted-foreground">No moves in your library yet.</p>
              )}
            </div>
          </div>
        </BottomSheetContent>
      </BottomSheet>
      <ExerciseFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        tagOptions={tags}
        initialName={search.trim()}
        onCreated={(exercise) => {
          router.refresh()
          pick(exercise)
        }}
      />
    </>
  )
}
