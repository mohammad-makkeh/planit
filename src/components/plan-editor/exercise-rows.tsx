'use client'

import { useState } from 'react'
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { TagOption } from '@/components/library/tag-multi-select'
import { Button } from '@/components/ui/button'
import type { ExerciseWithTags } from '@/services/exercises'
import type { EditorSession } from '@/services/plans'
import { ExercisePickerSheet } from './exercise-picker-sheet'
import { ExerciseRowCard } from './exercise-row-card'

type PickerMode = { type: 'add' } | { type: 'swap'; rowId: string } | null

export function ExerciseRows({
  session,
  exercises,
  tags,
  busy,
  onRowField,
  onAdd,
  onSwap,
  onDuplicate,
  onDelete,
  onReorder,
}: {
  session: EditorSession
  exercises: ExerciseWithTags[]
  tags: TagOption[]
  busy: boolean
  onRowField: (rowId: string, fields: Record<string, string | null>) => void
  onAdd: (exerciseId: string) => void
  onSwap: (rowId: string, exerciseId: string) => void
  onDuplicate: (rowId: string) => void
  onDelete: (rowId: string) => void
  onReorder: (orderedIds: string[]) => void
}) {
  const [picker, setPicker] = useState<PickerMode>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = session.rows.map((r) => r.id)
    onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  return (
    <div className="space-y-2">
      {session.rows.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={session.rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {session.rows.map((row) => (
                <ExerciseRowCard
                  key={row.id}
                  row={row}
                  onField={(fields) => onRowField(row.id, fields)}
                  onSwap={() => setPicker({ type: 'swap', rowId: row.id })}
                  onDuplicate={() => onDuplicate(row.id)}
                  onDelete={() => onDelete(row.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <Button variant="outline" className="w-full" onClick={() => setPicker({ type: 'add' })} disabled={busy}>
        <Plus className="size-4" /> Add move
      </Button>
      <ExercisePickerSheet
        open={picker !== null}
        onOpenChange={(open) => {
          if (!open) setPicker(null)
        }}
        exercises={exercises}
        tags={tags}
        onPick={(exerciseId) => {
          if (picker?.type === 'swap') onSwap(picker.rowId, exerciseId)
          else onAdd(exerciseId)
          setPicker(null)
        }}
      />
    </div>
  )
}
