'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Link2, Link2Off, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { generateShareSlugAction, revokeShareSlugAction } from '@/actions/plan-editor'
import { Button } from '@/components/ui/button'
import {
  BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle,
} from '@/components/ui/bottom-sheet'
import { Input } from '@/components/ui/input'
import { planMessage, whatsappLink, whatsappNumber } from '@/lib/whatsapp'

export function ShareSheet({
  open,
  onOpenChange,
  planId,
  client,
  shareSlug,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  /** Who the plan is for — the WhatsApp chat to open and the name in the message. */
  client: { name: string; phone: string | null }
  shareSlug: string | null
  onChanged: (slug: string | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setOrigin(window.location.origin) }, [])
  const url = shareSlug ? `${origin}/p/${shareSlug}` : null
  const message = url ? planMessage(client.name, url) : null
  const whatsapp = whatsappNumber(client.phone)

  async function generate() {
    setBusy(true)
    try {
      const result = await generateShareSlugAction(planId)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      onChanged(result.data.slug)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    setBusy(true)
    try {
      const result = await revokeShareSlugAction(planId)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      onChanged(null)
      toast.success('Link revoked')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
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
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>Share plan</BottomSheetTitle>
        </BottomSheetHeader>
        {url && message ? (
          <div className="space-y-3">
            <Input readOnly value={url} className="h-9 text-xs" />
            {/* WhatsApp keeps its full label; Copy and Open split what's left (or the whole row). */}
            <div className="flex gap-2">
              {/* Only the icon flips to a check, so the label never changes the button's width. */}
              <Button variant="outline" size="lg" className="min-w-0 flex-1" onClick={() => void copy()}>
                {copied ? <Check className="size-4 text-brand" /> : <Copy className="size-4" />} Copy
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="min-w-0 flex-1"
                nativeButton={false}
                render={<a href={url} target="_blank" rel="noopener noreferrer" />}
              >
                <ExternalLink className="size-4" /> Open
              </Button>
              {whatsapp && (
                <Button
                  size="lg"
                  // WhatsApp's own green, so the button reads as "opens WhatsApp" at a glance.
                  className="shrink-0 bg-[#25D366] font-semibold text-white hover:bg-[#1FB855]"
                  nativeButton={false}
                  render={<a href={whatsappLink(whatsapp, message)} target="_blank" rel="noopener noreferrer" />}
                >
                  <MessageCircle className="size-4" /> Send on WhatsApp
                </Button>
              )}
            </div>
            <Button variant="outline" size="lg" className="w-full text-destructive" onClick={() => void revoke()} disabled={busy}>
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
      </BottomSheetContent>
    </BottomSheet>
  )
}
