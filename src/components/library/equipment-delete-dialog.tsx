'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { deleteEquipmentAction } from '@/actions/equipment'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import type { EquipmentWithUsage } from '@/services/equipment'

export function EquipmentDeleteDialog({
  open,
  onOpenChange,
  equipment,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: EquipmentWithUsage
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function onDelete() {
    setDeleting(true)
    const result = await deleteEquipmentAction(equipment.id)
    setDeleting(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success('Equipment deleted')
    onOpenChange(false)
    onDeleted()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete {equipment.name}?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Used by {equipment.moveCount} move(s). They&apos;ll fall back to another of their
          equipment (or &quot;Any&quot;).
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => void onDelete()} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete equipment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
