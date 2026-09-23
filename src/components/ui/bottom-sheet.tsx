'use client'

import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'
import { cn } from 'cn'

/**
 * vaul's input repositioning is off for every sheet: on the first keyboard open it shoves the
 * sheet up past the top of the screen, taking the focused input with it. The browser's own
 * scroll-into-view keeps the input visible without it.
 */
function BottomSheet({
  repositionInputs = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="bottom-sheet" repositionInputs={repositionInputs} {...props} />
}

/**
 * `header` and `footer` render outside the scroll area, so they stay put while `children`
 * scroll between them — and nothing scrolls visibly beneath a pinned footer. The footer owns
 * the bottom safe-area padding whenever it is present.
 */
/**
 * A sheet opened from inside another sheet. vaul's nested root keeps the parent from reacting
 * to drags and outside presses that belong to this one, and scales the parent back behind it.
 */
function BottomSheetNested({
  repositionInputs = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.NestedRoot>) {
  return (
    <DrawerPrimitive.NestedRoot data-slot="bottom-sheet" repositionInputs={repositionInputs} {...props} />
  )
}

function BottomSheetContent({
  className,
  children,
  header,
  footer,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  header?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <DrawerPrimitive.Content
        data-slot="bottom-sheet-content"
        aria-describedby={undefined}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-popover text-sm text-popover-foreground outline-none ring-1 ring-foreground/10 md:max-w-lg',
          className,
        )}
        {...props}
      >
        <div
          aria-hidden
          className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25"
        />
        {header && <div className="shrink-0 px-6 pt-4 pb-3">{header}</div>}
        <div
          className={cn(
            'min-h-0 grow overflow-y-auto px-6',
            header ? 'pt-1' : 'pt-4',
            footer ? 'pb-4' : 'pb-[calc(env(safe-area-inset-bottom)+1.5rem)]',
          )}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t bg-popover px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
            {footer}
          </div>
        )}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  )
}

function BottomSheetHeader({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="bottom-sheet-header"
      className={cn('flex flex-col gap-2 pb-4', className)}
      {...props}
    />
  )
}

function BottomSheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="bottom-sheet-title"
      className={cn('font-heading text-base leading-none font-medium', className)}
      {...props}
    />
  )
}

export { BottomSheet, BottomSheetNested, BottomSheetContent, BottomSheetHeader, BottomSheetTitle }
