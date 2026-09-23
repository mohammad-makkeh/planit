'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, Dumbbell, MoreVertical, StickyNote, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { UnitInput } from '@/components/shared/unit-input'
import { cn } from '@/lib/utils'
import type { ExerciseWithDetails } from '@/services/exercises'
import type { EditorRow } from '@/services/plans'
import type { RowFieldPatch } from './plan-editor'
import { RowEquipmentSheet } from './row-equipment-sheet'

const FIELDS = [
  { key: 'sets', kind: 'int', label: 'Sets', min: 1, max: 99, unit: undefined },
  { key: 'reps', kind: 'int', label: 'Reps', min: 1, max: 999, unit: undefined },
  { key: 'rest', kind: 'int', label: 'Rest', min: 0, max: 3600, unit: 'sec' },
  { key: 'speed', kind: 'text', label: 'Speed', maxLength: 120 },
  { key: 'oneRm', kind: 'int', label: '1RM', min: 1, max: 100, unit: '%' },
] as const

export function ExerciseRowCard({
  row,
  exercises,
  onField,
  onSwap,
  onDuplicate,
  onDelete,
  onEquipmentChange,
}: {
  row: EditorRow
  exercises: ExerciseWithDetails[]
  onField: (fields: RowFieldPatch) => void
  onSwap: () => void
  onDuplicate: () => void
  onDelete: () => void
  onEquipmentChange: (equipmentId: string | null) => void
}) {
  const [noteOpen, setNoteOpen] = useState(row.note !== null && row.note !== '')
  const [equipmentSheetOpen, setEquipmentSheetOpen] = useState(false)
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  })

  const move = exercises.find((e) => e.id === row.exercise.id)
  const resolvedEquipment = move
    ? move.equipment.find((e) => e.id === row.equipmentId) ?? move.equipment.find((e) => e.id === move.defaultEquipmentId)
    : undefined
  const thumbnailUrl = row.exercise.imageUrl ?? resolvedEquipment?.imageUrl ?? null

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
      className={cn(
        'relative touch-manipulation space-y-2 rounded-2xl border bg-card p-3',
        // `rotate` is its own CSS property, so it composes with dnd-kit's inline `transform`.
        isDragging && 'rotate-2 border-brand bg-white shadow-lg dark:bg-card',
      )}
      {...listeners}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onSwap}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left hover:bg-accent/40"
        >
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt={row.exercise.name}
              className="size-9 rounded-lg border object-cover"
            />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <Dumbbell className="size-4 text-muted-foreground" />
            </div>
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.exercise.name}</span>
        </button>
        {move && resolvedEquipment && (
          <button
            type="button"
            onClick={() => setEquipmentSheetOpen(true)}
            className="flex shrink-0 touch-manipulation items-center gap-1 rounded-full border border-input px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent"
            aria-label={`Equipment for ${row.exercise.name}`}
          >
            {resolvedEquipment.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedEquipment.imageUrl}
                alt=""
                className="size-3.5 shrink-0 rounded-sm object-cover"
              />
            ) : (
              <Dumbbell className="size-3.5 shrink-0" />
            )}
            <span className="max-w-20 truncate">{resolvedEquipment.name}</span>
          </button>
        )}
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Row actions">
                  <MoreVertical className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {noteOpen ? (
                <DropdownMenuItem
                  onClick={() => {
                    onField({ note: null })
                    setNoteOpen(false)
                  }}
                >
                  <StickyNote className="size-4" /> Remove note
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setNoteOpen(true)}>
                  <StickyNote className="size-4" /> Add note
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="size-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="size-4" /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-0.5">
            <p className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {field.label}
            </p>
            {/* Only the inputs themselves opt out of long-press drag — labels and gaps still
                pick the card up. */}
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {field.kind === 'int' ? (
                <UnitInput
                  label={`${row.exercise.name} ${field.label}`}
                  unit={field.unit}
                  min={field.min}
                  max={field.max}
                  value={row[field.key]}
                  onChange={(value) => onField({ [field.key]: value })}
                  inputClassName={cn('h-8 px-1 text-center text-xs', field.unit && 'pr-5')}
                  unitClassName="right-1 text-[8px]"
                />
              ) : (
                <Input
                  value={row[field.key] ?? ''}
                  onChange={(e) => onField({ [field.key]: e.target.value })}
                  maxLength={field.maxLength}
                  className="h-8 px-1 text-center text-xs"
                  aria-label={`${row.exercise.name} ${field.label}`}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      {noteOpen && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <Textarea
            value={row.note ?? ''}
            onChange={(e) => onField({ note: e.target.value })}
            placeholder="Note for this move…"
            rows={2}
            maxLength={500}
            className="text-sm"
          />
        </div>
      )}
      {move && (
        <RowEquipmentSheet
          open={equipmentSheetOpen}
          onOpenChange={setEquipmentSheetOpen}
          moveName={move.name}
          equipment={move.equipment}
          defaultEquipmentId={move.defaultEquipmentId}
          selectedId={row.equipmentId}
          onSelect={onEquipmentChange}
        />
      )}
    </div>
  )
}
