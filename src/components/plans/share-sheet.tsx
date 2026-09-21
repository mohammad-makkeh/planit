'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Link2, Link2Off } from 'lucide-react'
import { toast } from 'sonner'
import { generateShareSlugAction, revokeShareSlugAction } from '@/actions/plan-editor'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export function ShareSheet({
  open,
  onOpenChange,
  planId,
  shareSlug,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  shareSlug: string | null
  onChanged: (slug: string | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOrigin(window.location.origin) }, [])
  const url = shareSlug ? `${origin}/p/${shareSlug}` : null

  async function generate() {
    setBusy(true)
    const result = await generateShareSlugAction(planId)
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    onChanged(result.data.slug)
  }

  async function revoke() {
    setBusy(true)
    const result = await revokeShareSlugAction(planId)
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error.message)
      return
    }
    onChanged(null)
    toast.success('Link revoked')
  }

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy — long-press the link to copy it.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share plan</DialogTitle>
        </DialogHeader>
        {url ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={url} className="text-xs" />
              <Button variant="outline" size="icon" onClick={() => void copy()} aria-label="Copy link">
                {copied ? <Check className="size-4 text-brand" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can view the plan. It always shows the latest saved version.
            </p>
            <Button variant="outline" className="w-full text-destructive" onClick={() => void revoke()} disabled={busy}>
              <Link2Off className="size-4" /> Revoke link
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Create a private link your client can open on their phone.
            </p>
            <Button className="w-full" onClick={() => void generate()} disabled={busy}>
              <Link2 className="size-4" /> {busy ? 'Creating…' : 'Create share link'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
