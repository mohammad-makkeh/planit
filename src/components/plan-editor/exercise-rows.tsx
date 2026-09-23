'use client'

import { useState } from 'react'
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { CatalogOption, EquipmentOption } from '@/components/library/catalog-picker-field'
import { Button } from '@/components/ui/button'
import type { ExerciseWithDetails } from '@/services/exercises'
import type { EditorSession } from '@/services/plans'
import { ExercisePickerSheet } from './exercise-picker-sheet'
import { ExerciseRowCard } from './exercise-row-card'
import type { PickedExercise, RowFieldPatch } from './plan-editor'

type PickerMode = { type: 'add' } | { type: 'swap'; rowId: string } | null

export function ExerciseRows({
  session,
  exercises,
  muscleTargets,
  equipmentOptions,
  onRowField,
  onAdd,
  onSwap,
  onDuplicate,
  onDelete,
  onReorder,
  onRowEquipment,
}: {
  session: EditorSession
  exercises: ExerciseWithDetails[]
  muscleTargets: CatalogOption[]
  equipmentOptions: EquipmentOption[]
  onRowField: (rowId: string, fields: RowFieldPatch) => void
  onAdd: (exercise: PickedExercise, equipmentId: string | null) => void
  onSwap: (rowId: string, exercise: PickedExercise, equipmentId: string | null) => void
  onDuplicate: (rowId: string) => void
  onDelete: (rowId: string) => void
  onReorder: (orderedIds: string[]) => void
  onRowEquipment: (rowId: string, equipmentId: string | null) => void
}) {
  const [picker, setPicker] = useState<PickerMode>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 350, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 8 } }),
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
                  exercises={exercises}
                  onField={(fields) => onRowField(row.id, fields)}
                  onSwap={() => setPicker({ type: 'swap', rowId: row.id })}
                  onDuplicate={() => onDuplicate(row.id)}
                  onDelete={() => onDelete(row.id)}
                  onEquipmentChange={(equipmentId) => onRowEquipment(row.id, equipmentId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <Button variant="outline" className="w-full" onClick={() => setPicker({ type: 'add' })}>
        <Plus className="size-4" /> Add move
      </Button>
      <ExercisePickerSheet
        open={picker !== null}
        onOpenChange={(open) => {
          if (!open) setPicker(null)
        }}
        exercises={exercises}
        muscleTargets={muscleTargets}
        equipmentOptions={equipmentOptions}
        onPick={(exercise, equipmentId) => {
          if (picker?.type === 'swap') onSwap(picker.rowId, exercise, equipmentId)
          else onAdd(exercise, equipmentId)
          setPicker(null)
        }}
      />
    </div>
  )
}
