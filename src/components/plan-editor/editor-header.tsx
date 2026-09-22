'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Copy, Link2, MoreVertical, Save, Trash2 } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { EditorPlan } from '@/services/plans'

export function EditorHeader({
  plan,
  dirty,
  saving,
  onTitleChange,
  onStatusChange,
  onSave,
  onEnsureSaved,
  onShareChanged,
}: {
  plan: EditorPlan
  dirty: boolean
  saving: boolean
  onTitleChange: (title: string) => void
  onStatusChange: (status: EditorPlan['status']) => void
  onSave: () => void
  onEnsureSaved: () => Promise<boolean>
  onShareChanged: (slug: string | null) => void
}) {
  const router = useRouter()
  const [shareOpen, setShareOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const backHref = `/clients/${plan.clientId}`

  async function duplicate() {
    if (busy) return
    setBusy(true)
    try {
      if (dirty) {
        const saved = await onEnsureSaved()
        if (!saved) return
      }
      const result = await duplicatePlanAction(plan.id)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Duplicated — you are now editing the copy')
      router.push(`/clients/${plan.clientId}/plans/${result.data.id}`)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    if (busy) return
    setBusy(true)
    try {
      const result = await deletePlanAction(plan.id)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Plan deleted')
      router.push(backHref)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function saveAndLeave() {
    const saved = await onEnsureSaved()
    if (saved) router.push(backHref)
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="flex items-center gap-1 px-2 py-2 md:px-6">
        <button
          type="button"
          onClick={() => (dirty ? setLeaveOpen(true) : router.push(backHref))}
          className="flex items-center gap-1 p-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> {plan.client.name}
        </button>
        <span className="sr-only" aria-live="polite">
          {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved'}
        </span>
        <Button
          size="sm"
          onClick={onSave}
          disabled={!dirty || saving}
          variant={dirty ? 'default' : 'secondary'}
          className={cn('ml-auto', !dirty && !saving && 'text-muted-foreground')}
        >
          {saving ? null : dirty ? <Save className="size-4" /> : <Check className="size-4" />}
          {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
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
            <DropdownMenuItem onClick={() => void duplicate()}>
              <Copy className="size-4" /> Duplicate plan
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShareOpen(true)}>
              <Link2 className="size-4" /> Share
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" /> Delete plan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-2 px-4 pb-3 md:px-8">
        <input
          value={plan.title}
          onChange={(e) => onTitleChange(e.target.value)}
          maxLength={200}
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

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You have edits that haven&apos;t been saved yet.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => router.push(backHref)}>Discard</Button>
            <Button onClick={() => void saveAndLeave()} disabled={saving}>
              Save &amp; leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
