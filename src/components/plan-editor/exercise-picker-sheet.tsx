'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Dumbbell, Plus, Search } from 'lucide-react'
import type { EquipmentOption } from '@/components/library/equipment-multi-select'
import { ExerciseFormSheet } from '@/components/library/exercise-form-sheet'
import { TagFilter } from '@/components/library/tag-filter'
import type { TagOption } from '@/components/library/tag-multi-select'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ExerciseWithTags } from '@/services/exercises'
import {
  BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle,
} from '@/components/ui/bottom-sheet'
import type { PickedExercise } from './plan-editor'

function equipmentChipClass(): string {
  return 'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30'
}

function moveThumbnail(e: ExerciseWithTags): string | null {
  if (e.imageUrl) return e.imageUrl
  return e.equipment.find((eq) => eq.id === e.defaultEquipmentId)?.imageUrl ?? null
}

export function ExercisePickerSheet({
  open,
  onOpenChange,
  exercises,
  tags,
  equipmentOptions,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercises: ExerciseWithTags[]
  tags: TagOption[]
  equipmentOptions: EquipmentOption[]
  onPick: (exercise: PickedExercise, equipmentId: string | null) => void
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [tagId, setTagId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return exercises.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false
      if (tagId && !e.tags.some((t) => t.id === tagId)) return false
      return true
    })
  }, [exercises, search, tagId])

  const exactMatch = exercises.some((e) => e.name.toLowerCase() === search.trim().toLowerCase())

  function pick(exercise: PickedExercise, equipmentId: string | null) {
    onPick(exercise, equipmentId)
    setSearch('')
    setTagId(null)
    setExpandedId(null)
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
              {filtered.map((e) => {
                const thumb = moveThumbnail(e)
                const expandable = e.equipment.length > 1
                const expanded = expandable && expandedId === e.id
                return (
                  <div key={e.id} className="rounded-xl border bg-card">
                    <button
                      type="button"
                      onClick={() => {
                        if (expandable) {
                          setExpandedId((cur) => (cur === e.id ? null : e.id))
                        } else {
                          pick({ id: e.id, name: e.name, imageUrl: e.imageUrl }, null)
                        }
                      }}
                      className="flex w-full items-center gap-3 p-2.5 text-left hover:bg-accent/40"
                    >
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt={e.name} className="size-10 rounded-lg border object-cover" />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                          <Dumbbell className="size-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.name}</span>
                      {expandable && (
                        <ChevronDown
                          className={cn(
                            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                            expanded && 'rotate-180',
                          )}
                        />
                      )}
                    </button>
                    {expandable && (
                      <div
                        className={cn(
                          'grid transition-[grid-template-rows] duration-200 ease-in-out',
                          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                        )}
                      >
                        <div className="overflow-hidden">
                          <div className="flex flex-wrap gap-1.5 px-2.5 pb-2.5">
                            {e.equipment.map((eq) => (
                              <button
                                key={eq.id}
                                type="button"
                                onClick={() => pick({ id: e.id, name: e.name, imageUrl: e.imageUrl }, eq.id)}
                                className={equipmentChipClass()}
                              >
                                {eq.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={eq.imageUrl} alt="" className="size-4 shrink-0 rounded-sm object-cover" />
                                ) : (
                                  <Dumbbell className="size-4 shrink-0 text-muted-foreground" />
                                )}
                                {eq.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
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
        equipmentOptions={equipmentOptions}
        initialName={search.trim()}
        onCreated={(exercise) => {
          router.refresh()
          pick(exercise, null)
        }}
      />
    </>
  )
}
