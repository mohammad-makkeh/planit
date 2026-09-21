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
import { cn } from '@/lib/utils'
import type { EditorRow } from '@/services/plans'

const FIELDS = [
  { key: 'sets', label: 'Sets', maxLength: 40 },
  { key: 'reps', label: 'Reps', maxLength: 40 },
  { key: 'speed', label: 'Speed', maxLength: 120 },
  { key: 'oneRm', label: '1RM', maxLength: 120 },
  { key: 'rest', label: 'Rest', maxLength: 60 },
] as const

export function ExerciseRowCard({
  row,
  onField,
  onSwap,
  onDuplicate,
  onDelete,
}: {
  row: EditorRow
  onField: (fields: Record<string, string | null>) => void
  onSwap: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [noteOpen, setNoteOpen] = useState(row.note !== null && row.note !== '')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  })

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
          {row.exercise.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.exercise.imageUrl}
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
        {FIELDS.map(({ key, label, maxLength }) => (
          <div key={key} className="space-y-0.5">
            <p className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <Input
              value={row[key] ?? ''}
              onChange={(e) => onField({ [key]: e.target.value })}
              maxLength={maxLength}
              className="h-8 px-1 text-center text-xs"
              aria-label={`${row.exercise.name} ${label}`}
            />
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
    </div>
  )
}
