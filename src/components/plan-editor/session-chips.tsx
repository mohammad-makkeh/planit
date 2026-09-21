'use client'

import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EditorSession } from '@/services/plans'

function SessionChip({
  session,
  active,
  onSelect,
}: {
  session: EditorSession
  active: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: session.id,
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'shrink-0 touch-manipulation rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
        active ? 'border-brand bg-brand text-brand-foreground' : 'bg-card text-muted-foreground',
        isDragging && 'z-10 opacity-80',
      )}
      {...attributes}
      {...listeners}
    >
      {session.label}
    </button>
  )
}

export function SessionChips({
  sessions,
  activeSessionId,
  onSelect,
  onAdd,
  onReorder,
  adding,
}: {
  sessions: EditorSession[]
  activeSessionId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onReorder: (orderedIds: string[]) => void
  adding: boolean
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = sessions.map((s) => s.id)
    const reordered = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    onReorder(reordered)
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 md:px-8 [-ms-overflow-style:none] [scrollbar-width:none]">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sessions.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          {sessions.map((s) => (
            <SessionChip
              key={s.id}
              session={s}
              active={s.id === activeSessionId}
              onSelect={() => onSelect(s.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={onAdd}
        disabled={adding}
        aria-label="Add session"
        className="flex size-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground hover:bg-accent/50"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}
