'use client'

import { useState } from 'react'
import { Check, Flame, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  createWarmupAction, deleteWarmupAction, updateWarmupAction,
} from '@/actions/warmups'
import { EmptyState } from '@/components/shell/empty-state'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { WarmupPreset } from '@/services/warmups'

export function WarmupsTab({ warmups }: { warmups: WarmupPreset[] }) {
  const [newText, setNewText] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [deleting, setDeleting] = useState<WarmupPreset | null>(null)

  async function create() {
    const text = newText.trim()
    if (!text) return
    setBusy(true)
    const result = await createWarmupAction({ text })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    setNewText('')
  }

  async function saveEdit(id: string) {
    setBusy(true)
    const result = await updateWarmupAction(id, { text: editText })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    setEditingId(null)
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    const result = await deleteWarmupAction(deleting.id)
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    setDeleting(null)
  }

  return (
    <div className="space-y-3 pt-3">
      <div className="flex gap-2">
        <Input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Add a warm-up line…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void create()
            }
          }}
        />
        <Button onClick={() => void create()} disabled={busy || !newText.trim()} size="icon" aria-label="Add warm-up">
          <Plus className="size-4" />
        </Button>
      </div>

      {warmups.length === 0 ? (
        <EmptyState
          icon={<Flame className="size-8 text-muted-foreground" />}
          title="No warm-ups yet"
          description="Saved warm-up lines can be reused in every plan."
        />
      ) : (
        <div className="space-y-2">
          {warmups.map((w) => (
            <div key={w.id} className="flex items-center gap-2 rounded-xl border bg-card p-3">
              {editingId === w.id ? (
                <>
                  <Input value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus />
                  <Button size="icon" variant="ghost" onClick={() => void saveEdit(w.id)} disabled={busy} aria-label="Save">
                    <Check className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} aria-label="Cancel">
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <p className="flex-1 text-sm">{w.text}</p>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(w.id)
                      setEditText(w.text)
                    }}
                    aria-label="Edit warm-up"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleting(w)} aria-label="Delete warm-up">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this warm-up?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            &quot;{deleting?.text}&quot; will be removed from your presets. Plans that already use it keep
            their text.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={busy}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
