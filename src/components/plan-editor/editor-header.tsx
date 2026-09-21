'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, Link2, MoreVertical, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deletePlanAction, duplicatePlanAction } from '@/actions/plan-editor'
import { ShareSheet } from '@/components/plans/share-sheet'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { SaveStatus } from '@/hooks/use-autosave'
import { cn } from '@/lib/utils'
import type { EditorPlan } from '@/services/plans'

const SAVE_LABEL: Record<SaveStatus, string> = {
  saved: 'Saved ✓',
  saving: 'Saving…',
  dirty: 'Unsaved changes',
}

export function EditorHeader({
  plan,
  saveStatus,
  onTitleChange,
  onStatusChange,
  onSave,
  onShareChanged,
  onFlushPending,
}: {
  plan: EditorPlan
  saveStatus: SaveStatus
  onTitleChange: (title: string) => void
  onStatusChange: (status: EditorPlan['status']) => void
  onSave: () => void
  onShareChanged: (slug: string | null) => void
  onFlushPending: () => Promise<boolean>
}) {
  const router = useRouter()
  const [shareOpen, setShareOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function duplicate() {
    await onFlushPending()
    const result = await duplicatePlanAction(plan.id)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success('Duplicated — you are now editing the copy')
    router.push(`/clients/${plan.clientId}/plans/${result.data.id}`)
  }

  async function onDelete() {
    setBusy(true)
    await onFlushPending()
    const result = await deletePlanAction(plan.id)
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    toast.success('Plan deleted')
    router.push(`/clients/${plan.clientId}`)
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="flex items-center gap-1 px-2 py-2 md:px-6">
        <Link
          href={`/clients/${plan.clientId}`}
          className="flex items-center gap-1 p-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> {plan.client.name}
        </Link>
        <span
          className={cn(
            'ml-auto text-xs',
            saveStatus === 'dirty' ? 'text-brand' : 'text-muted-foreground',
          )}
        >
          {SAVE_LABEL[saveStatus]}
        </span>
        <Button size="sm" variant="outline" onClick={onSave} disabled={saveStatus === 'saving'}>
          Save
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Plan actions">
                <MoreVertical className="size-5" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void duplicate()}>
              <Copy className="size-4" /> Duplicate plan
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setShareOpen(true)}>
              <Link2 className="size-4" /> Share
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" /> Delete plan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3 md:px-8">
        <input
          value={plan.title}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="Plan title"
          className="min-w-0 flex-1 bg-transparent text-xl font-bold tracking-tight outline-none placeholder:text-muted-foreground"
          placeholder="Plan title"
        />
        <Select value={plan.status} onValueChange={(v) => onStatusChange(v as EditorPlan['status'])}>
          <SelectTrigger className="w-32" size="sm" aria-label="Plan status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        planId={plan.id}
        shareSlug={plan.shareSlug}
        onChanged={onShareChanged}
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
    </header>
  )
}
