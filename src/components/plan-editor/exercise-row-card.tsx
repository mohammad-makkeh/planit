'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, Dumbbell, GripVertical, MoreVertical, StickyNote, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { parseIntegerInput } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ExerciseWithTags } from '@/services/exercises'
import type { EditorRow } from '@/services/plans'
import type { RowFieldPatch } from './plan-editor'
import { RowEquipmentSheet } from './row-equipment-sheet'

const FIELDS = [
  { key: 'sets', kind: 'int', label: 'Sets', min: 1, max: 99 },
  { key: 'reps', kind: 'int', label: 'Reps', min: 1, max: 999 },
  { key: 'speed', kind: 'text', label: 'Speed', maxLength: 120 },
  { key: 'oneRm', kind: 'int', label: '1RM', min: 1, max: 100 },
  { key: 'rest', kind: 'int', label: 'Rest', min: 0, max: 3600 },
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
  exercises: ExerciseWithTags[]
  onField: (fields: RowFieldPatch) => void
  onSwap: () => void
  onDuplicate: () => void
  onDelete: () => void
  onEquipmentChange: (equipmentId: string | null) => void
}) {
  const [noteOpen, setNoteOpen] = useState(row.note !== null && row.note !== '')
  const [equipmentSheetOpen, setEquipmentSheetOpen] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
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
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('space-y-2 rounded-2xl border bg-card p-3', isDragging && 'z-10 opacity-80')}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Reorder move"
          className="cursor-grab touch-none p-1 text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
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
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setNoteOpen((v) => !v)}
          aria-label="Toggle note"
        >
          <StickyNote
            className={cn('size-4', row.note ? 'text-brand' : 'text-muted-foreground')}
          />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Row actions">
                <MoreVertical className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="size-4" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-4" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-0.5">
            <p className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {field.label}
            </p>
            {field.kind === 'int' ? (
              <Input
                type="number"
                inputMode="numeric"
                min={field.min}
                max={field.max}
                value={row[field.key] ?? ''}
                onChange={(e) => onField({ [field.key]: parseIntegerInput(e.target.value) })}
                className="h-8 px-1 text-center text-xs"
                aria-label={`${row.exercise.name} ${field.label}`}
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
        ))}
      </div>
      {noteOpen && (
        <Textarea
          value={row.note ?? ''}
          onChange={(e) => onField({ note: e.target.value })}
          placeholder="Note for this move…"
          rows={2}
          maxLength={500}
          className="text-sm"
        />
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
