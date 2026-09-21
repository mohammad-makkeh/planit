'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteClientAction } from '@/actions/clients'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ClientFormDialog, type ClientFormClient } from './client-form-dialog'

export function ClientActionsMenu({ client }: { client: ClientFormClient }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function onDelete() {
    setDeleting(true)
    const result = await deleteClientAction(client.id)
    setDeleting(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success('Client deleted')
    router.push('/')
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Client actions">
              <MoreVertical className="size-5" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" /> Edit details
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" /> Delete client
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={client} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {client.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The client and their plans will no longer appear in Planit.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={onDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
