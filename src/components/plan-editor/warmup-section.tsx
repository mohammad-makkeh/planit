'use client'

import { useId, useState } from 'react'
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Flame, GripVertical, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WarmupLine } from '@/db/schema'
import { cn } from '@/lib/utils'

// Warm-up lines are plain `{ text, highlighted }` values (duplicates allowed), so each line gets
// a client-only identity for dnd-kit and React keys. Position-based ids made a drop re-render the
// moved text into slots dnd-kit was still easing back from their shifted positions.
let nextLineId = 0
function newLineIds(count: number): string[] {
  return Array.from({ length: count }, () => `warmup-${nextLineId++}`)
}

function WarmupLineItem({
  id,
  line,
  onToggleHighlight,
  onRemove,
}: {
  id: string
  line: WarmupLine
  onToggleHighlight: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
      className={cn(
        'relative flex items-center gap-1 rounded-xl border bg-card p-2',
        line.highlighted && 'border-brand/40 bg-brand/5',
        // Matches the dragged exercise card; `rotate` composes with dnd-kit's inline `transform`.
        isDragging && 'rotate-2 border-brand bg-white shadow-lg dark:bg-card',
      )}
    >
      <button
        type="button"
        aria-label="Reorder warm-up line"
        className="cursor-grab touch-none p-1 text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <p className="min-w-0 flex-1 text-sm">{line.text}</p>
      <Button
        size="icon"
        variant="ghost"
        onClick={onToggleHighlight}
        aria-label={line.highlighted ? 'Remove highlight' : 'Highlight line'}
      >
        <Flame className={cn('size-4', line.highlighted ? 'text-brand' : 'text-muted-foreground')} />
      </Button>
      <Button size="icon" variant="ghost" onClick={onRemove} aria-label="Remove warm-up line">
        <X className="size-4 text-muted-foreground" />
      </Button>
    </div>
  )
}

export function WarmupSection({
  lines,
  onChange,
  onOpenPicker,
}: {
  lines: WarmupLine[]
  onChange: (lines: WarmupLine[]) => void
  onOpenPicker: () => void
}) {
  // A stable id keeps dnd-kit's generated aria-describedby ids equal on server and client.
  const dndId = useId()
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const [lineIds, setLineIds] = useState(() => newLineIds(lines.length))
  // Lines added from outside (the picker) or a switched day change the count — resync during
  // render so ids and lines never disagree for a frame.
  let ids = lineIds
  if (ids.length !== lines.length) {
    ids =
      lines.length > ids.length
        ? [...ids, ...newLineIds(lines.length - ids.length)]
        : ids.slice(0, lines.length)
    setLineIds(ids)
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    setLineIds(arrayMove(ids, from, to))
    onChange(arrayMove(lines, from, to))
  }

  function remove(index: number) {
    setLineIds(ids.filter((_, i) => i !== index))
    onChange(lines.filter((_, i) => i !== index))
  }

  return (
    <section className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Warm-up</p>
      {lines.length > 0 && (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {lines.map((line, index) => {
                // `ids` is resynced to `lines.length` above, so every index has an id.
                const id = ids[index]!
                return (
                  <WarmupLineItem
                    key={id}
                    id={id}
                    line={line}
                    onToggleHighlight={() =>
                      onChange(
                        lines.map((l, i) => (i === index ? { ...l, highlighted: !l.highlighted } : l)),
                      )
                    }
                    onRemove={() => remove(index)}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <Button variant="outline" size="sm" onClick={onOpenPicker}>
        <Plus className="size-4" /> Add warm-up
      </Button>
    </section>
  )
}
