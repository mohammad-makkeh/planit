'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { Download, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle,
} from '@/components/ui/bottom-sheet'
import { STORY_DESIGNS, localDateParam, type StoryDesign } from '@/lib/story'
import { cn } from '@/lib/utils'

type Card = { url: string; file: File }
type Cards = Partial<Record<StoryDesign, Card | 'error'>>

/**
 * Picks a story card design for the selected day and hands the PNG to the phone's share sheet
 * (straight into Instagram), or downloads it where files can't be shared. The sheet portals out
 * of the share page, so it carries the coach's `--brand` itself.
 */
export function StorySheet({
  open,
  onOpenChange,
  slug,
  dayIndex,
  headline,
  clientName,
  brand,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string
  dayIndex: number
  /** "Chest day" — what the cards will say. */
  headline: string
  clientName: string
  brand: string
}) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      {/* Wider than a form sheet: the cards are the content here. */}
      <BottomSheetContent className="md:max-w-xl" style={{ '--brand': brand } as CSSProperties}>
        {/* Mounted only while open, and remounted per day, so each opening starts fresh. */}
        {open && <StoryPicker key={dayIndex} slug={slug} dayIndex={dayIndex} headline={headline} clientName={clientName} />}
      </BottomSheetContent>
    </BottomSheet>
  )
}

function StoryPicker({
  slug,
  dayIndex,
  headline,
  clientName,
}: {
  slug: string
  dayIndex: number
  headline: string
  clientName: string
}) {
  const [cards, setCards] = useState<Cards>({})
  const [selected, setSelected] = useState<StoryDesign>(STORY_DESIGNS[0].id)

  // Both cards are fetched up front: the previews need them anyway, and having the file ready
  // means the share call runs straight from the tap — iOS drops the share sheet if the tap's
  // user activation expires while a download is still in flight.
  useEffect(() => {
    const controller = new AbortController()
    const urls: string[] = []
    const date = localDateParam()
    const baseName = `${clientName.trim().replace(/[^a-zA-Z0-9]+/g, '_') || 'My'}_${headline.replace(/\s+/g, '_')}`
    for (const { id } of STORY_DESIGNS) {
      fetch(`/p/${slug}/story/${id}/${dayIndex}?date=${date}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(String(response.status))
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          urls.push(url)
          // Decoded before it's shown, so the card appears whole instead of painting top-down.
          const image = new Image()
          image.src = url
          await image.decode()
          const file = new File([blob], `${baseName}_${id}.png`, { type: 'image/png' })
          setCards((current) => ({ ...current, [id]: { url, file } }))
        })
        .catch(() => {
          if (!controller.signal.aborted) setCards((current) => ({ ...current, [id]: 'error' }))
        })
    }
    return () => {
      controller.abort()
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [slug, dayIndex, headline, clientName])

  const card = cards[selected]
  const ready = card !== undefined && card !== 'error'
  const canShareFiles = ready && typeof navigator.canShare === 'function' && navigator.canShare({ files: [card.file] })

  async function post() {
    if (!ready) return
    if (canShareFiles) {
      try {
        await navigator.share({ files: [card.file] })
      } catch (error) {
        // Closing the share sheet rejects with AbortError — a choice, not a failure.
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          toast.error('Could not open sharing. Try downloading the image instead.')
        }
      }
      return
    }
    const link = document.createElement('a')
    link.href = card.url
    link.download = card.file.name
    link.click()
    toast.success('Saved — post it to your story from your photos')
  }

  return (
    <>
      <BottomSheetHeader>
        <BottomSheetTitle>Post today&apos;s workout</BottomSheetTitle>
        <p className="text-sm text-muted-foreground">Pick a look for your {headline.toLowerCase()} story.</p>
      </BottomSheetHeader>

      {/* Scrolls sideways like the day chips, one and a half cards per view so the next one
          peeks in; it bleeds to the sheet edges so a card isn't clipped mid-gutter. */}
      <div
        className="-mx-6 flex gap-3 overflow-x-auto px-6 py-1 [-ms-overflow-style:none] [scrollbar-width:none]"
        role="radiogroup"
        aria-label="Story design"
      >
        {STORY_DESIGNS.map(({ id }, i) => {
          const design = cards[id]
          const active = id === selected
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`Design ${i + 1}`}
              onClick={() => setSelected(id)}
              className={cn(
                'relative aspect-[9/16] w-[calc((100%-0.75rem)/1.5)] shrink-0 overflow-hidden rounded-xl bg-muted outline-none ring-offset-2 ring-offset-popover transition-shadow focus-visible:ring-2 focus-visible:ring-ring',
                active && 'ring-2 ring-brand focus-visible:ring-brand',
              )}
            >
              {design === undefined && (
                <span className="absolute inset-0 animate-shimmer bg-muted-foreground/10 bg-[linear-gradient(100deg,transparent_30%,rgba(255,255,255,0.65)_50%,transparent_70%)] bg-[length:200%_100%]" />
              )}
              {design === 'error' && (
                <span className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-muted-foreground">
                  Couldn&apos;t load this one
                </span>
              )}
              {design !== undefined && design !== 'error' && (
                // eslint-disable-next-line @next/next/no-img-element -- a local blob URL, nothing to optimise
                <img src={design.url} alt="" className="size-full object-cover animate-in fade-in duration-300" />
              )}
            </button>
          )
        })}
      </div>

      <div className="pt-5">
        <Button className="h-11 w-full bg-brand text-brand-foreground hover:bg-brand/90" disabled={!ready} onClick={() => void post()}>
          {ready && !canShareFiles ? <Download className="size-4" /> : <Send className="size-4" />}
          {ready && !canShareFiles ? 'Download image' : 'Post to story'}
        </Button>
      </div>
    </>
  )
}
