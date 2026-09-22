'use client'

import { Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle,
} from '@/components/ui/bottom-sheet'
import type { SharedRow } from '@/services/share'

export function MoveLightbox({
  row,
  open,
  onOpenChange,
}: {
  row: SharedRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const imageUrl = row ? (row.exercise.imageUrl ?? row.equipment?.imageUrl ?? null) : null

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        {row && (
          <>
            <BottomSheetHeader>
              <BottomSheetTitle>{row.exercise.name}</BottomSheetTitle>
            </BottomSheetHeader>
            <div className="space-y-4">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  className="max-h-[50dvh] w-full rounded-xl border bg-muted object-contain"
                />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-xl bg-muted">
                  <Dumbbell className="size-10 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-input bg-background px-2 text-[10px] font-medium text-muted-foreground">
                  {row.movementType.charAt(0).toUpperCase() + row.movementType.slice(1)}
                </span>
                {row.equipment && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-input px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {row.equipment.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.equipment.imageUrl}
                        alt=""
                        className="size-3.5 shrink-0 rounded-sm object-cover"
                      />
                    ) : (
                      <Dumbbell className="size-3.5 shrink-0" />
                    )}
                    {row.equipment.name}
                  </span>
                )}
              </div>
              {row.exercise.tutorialUrl && (
                <Button
                  size="lg"
                  className="h-11 w-full bg-brand text-brand-foreground hover:bg-brand/90"
                  nativeButton={false}
                  render={
                    <a href={row.exercise.tutorialUrl} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  Watch tutorial
                </Button>
              )}
            </div>
          </>
        )}
      </BottomSheetContent>
    </BottomSheet>
  )
}
