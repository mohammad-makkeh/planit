'use client'

import * as React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A bottom sheet that can open on top of a Base UI `Dialog`. The app's `BottomSheet` is vaul,
 * and a vaul sheet over a modal Base UI dialog fights it for focus and outside presses; nested
 * Base UI dialogs stack natively. It matches `BottomSheet`'s look (slides up, rounded top,
 * `md` max width) — with an X instead of a drag handle, since it can't be swiped away.
 *
 * `className` / `style` land on the popup: it portals to `body`, so a caller inside a scoped
 * theme (the gym player's `dark` scope and its `--brand`) passes them through explicitly.
 */
export function DialogSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  style,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const popupRef = React.useRef<HTMLDivElement>(null)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* A nested dialog's backdrop only renders when forced. */}
        <DialogPrimitive.Backdrop
          forceRender
          className="fixed inset-0 z-50 bg-black/40 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        {/* Focus lands on the sheet, not its X, so opening it doesn't flash a focus ring. */}
        <DialogPrimitive.Popup
          ref={popupRef}
          initialFocus={popupRef}
          tabIndex={-1}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full flex-col rounded-t-2xl bg-popover text-sm text-popover-foreground outline-none ring-1 ring-foreground/10 duration-200 data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom md:max-w-lg',
            className,
          )}
          style={style}
        >
          <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3">
            <DialogPrimitive.Title className="font-heading text-base leading-none font-medium">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close"
              className="-mr-2 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
            {children}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
