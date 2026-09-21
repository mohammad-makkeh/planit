'use client'

import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Flame, GripVertical, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WarmupLine } from '@/db/schema'
import { cn } from '@/lib/utils'

function WarmupLineItem({
  line,
  index,
  onToggleHighlight,
  onRemove,
}: {
  line: WarmupLine
  index: number
  onToggleHighlight: () => void
  onRemove: () => void
}) {
  const id = `warmup-${index}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-1 rounded-xl border bg-card p-2',
        line.highlighted && 'border-brand/40 bg-brand/5',
        isDragging && 'z-10 opacity-80',
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
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = Number(String(active.id).replace('warmup-', ''))
    const to = Number(String(over.id).replace('warmup-', ''))
    onChange(arrayMove(lines, from, to))
  }

  return (
    <section className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Warm-up</p>
      {lines.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={lines.map((_, i) => `warmup-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1.5">
              {lines.map((line, index) => (
                <WarmupLineItem
                  key={`warmup-${index}`}
                  line={line}
                  index={index}
                  onToggleHighlight={() =>
                    onChange(
                      lines.map((l, i) => (i === index ? { ...l, highlighted: !l.highlighted } : l)),
                    )
                  }
                  onRemove={() => onChange(lines.filter((_, i) => i !== index))}
                />
              ))}
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
