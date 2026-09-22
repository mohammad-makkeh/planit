'use client'

import { useState } from 'react'
import { Dumbbell, Pencil, Plus, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/shell/empty-state'
import { Button } from '@/components/ui/button'
import type { EquipmentWithUsage } from '@/services/equipment'
import { EquipmentDeleteDialog } from './equipment-delete-dialog'
import { EquipmentFormSheet } from './equipment-form-sheet'

export function EquipmentTab({ equipment }: { equipment: EquipmentWithUsage[] }) {
  const [editing, setEditing] = useState<EquipmentWithUsage | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleting, setDeleting] = useState<EquipmentWithUsage | null>(null)

  return (
    <div className="space-y-3 pt-3">
      <Button onClick={() => setCreateOpen(true)} className="w-full">
        <Plus className="size-4" /> Add equipment
      </Button>

      {equipment.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="size-8 text-muted-foreground" />}
          title="No equipment yet"
          description="Add equipment to assign it to moves."
        />
      ) : (
        <div className="space-y-2">
          {equipment.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="size-10 shrink-0 rounded-lg border object-cover"
                />
              ) : (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Dumbbell className="size-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">Used by {item.moveCount} move(s)</p>
              </div>
              <Button
                size="icon-lg"
                variant="ghost"
                onClick={() => setEditing(item)}
                aria-label={`Edit ${item.name}`}
              >
                <Pencil className="size-4" />
              </Button>
              {!item.isFallback && (
                <Button
                  size="icon-lg"
                  variant="ghost"
                  onClick={() => setDeleting(item)}
                  aria-label={`Delete ${item.name}`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <EquipmentFormSheet open={createOpen} onOpenChange={setCreateOpen} />
      {editing && (
        <EquipmentFormSheet
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          equipment={editing}
        />
      )}
      {deleting && (
        <EquipmentDeleteDialog
          open={deleting !== null}
          onOpenChange={(open) => {
            if (!open) setDeleting(null)
          }}
          equipment={deleting}
          onDeleted={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
