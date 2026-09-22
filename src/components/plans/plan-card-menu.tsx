'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, FileDown, Link2, MoreVertical, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { deletePlanAction, duplicatePlanAction } from '@/actions/plan-editor'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { downloadPdf } from '@/lib/pdf-download'
import type { Plan } from '@/services/plans'
import { ClientPickerSheet, type PickerClient } from './client-picker-sheet'
import { ShareSheet } from './share-sheet'

export function PlanCardMenu({
  plan,
  clients,
  currentClientId,
}: {
  plan: { id: string; title: string; status: Plan['status']; shareSlug: string | null }
  clients: PickerClient[]
  currentClientId: string
}) {
  const router = useRouter()
  const [shareOpen, setShareOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [slug, setSlug] = useState(plan.shareSlug)
  const [busy, setBusy] = useState(false)

  async function duplicateInPlace() {
    setBusy(true)
    try {
      const result = await duplicatePlanAction(plan.id)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Plan duplicated')
      router.refresh()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function duplicateTo(clientId: string) {
    setPickerOpen(false)
    setBusy(true)
    try {
      const result = await duplicatePlanAction(plan.id, clientId)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Plan copied')
      router.push(`/clients/${clientId}`)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function exportPDF() {
    const id = toast.loading('Preparing PDF…')
    const result = await downloadPdf(`/plans/${plan.id}/pdf`)
    if (result.ok) {
      toast.success('PDF downloaded', { id })
    } else {
      toast.error(result.message, { id })
    }
  }

  async function onDelete() {
    setBusy(true)
    try {
      const result = await deletePlanAction(plan.id)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Plan deleted')
      setDeleteOpen(false)
      router.refresh()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Plan actions">
              <MoreVertical className="size-5" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem onClick={() => void duplicateInPlace()}>
            <Copy className="size-4" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPickerOpen(true)}>
            <UserPlus className="size-4" /> Copy to another client
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShareOpen(true)}>
            <Link2 className="size-4" /> Share
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void exportPDF()}>
            <FileDown className="size-4" /> Export PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" /> Delete plan
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        planId={plan.id}
        shareSlug={slug}
        onChanged={setSlug}
      />
      <ClientPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        clients={clients}
        excludeClientId={currentClientId}
        onPick={(clientId) => void duplicateTo(clientId)}
      />
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {plan.title}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The plan will no longer appear in Planit, and its share link will stop working.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void onDelete()} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
