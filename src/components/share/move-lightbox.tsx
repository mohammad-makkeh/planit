'use client'

import { Dumbbell } from 'lucide-react'
import { MuscleMap } from '@/components/shared/muscle-map'
import { MusclePill } from '@/components/shared/muscle-pill'
import { Button } from '@/components/ui/button'
import {
  BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle,
} from '@/components/ui/bottom-sheet'
import { shadesForMove } from '@/lib/muscle-map'
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
  // Same precedence as `MoveThumbnail`: the body figure, else the equipment icon.
  const showBodyHero = row !== null && row.muscles.length > 0
  const fallbackUrl = row?.equipment?.imageUrl ?? null

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        {row && (
          <>
            <BottomSheetHeader>
              <BottomSheetTitle>{row.exercise.name}</BottomSheetTitle>
            </BottomSheetHeader>
            <div className="space-y-4">
              {showBodyHero ? (
                <div className="flex h-[min(40dvh,20rem)] items-center justify-center rounded-xl border bg-muted/40 p-5">
                  <MuscleMap
                    shades={shadesForMove(row.muscles)}
                    label={`Muscles worked: ${row.muscles.map((m) => m.name).join(', ')}`}
                    className="size-full justify-center"
                  />
                </div>
              ) : fallbackUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fallbackUrl}
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
              {row.muscles.length > 0 && (
                <div className="space-y-1.5 rounded-xl border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Works
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {row.muscles.map((m) => (
                      <MusclePill key={m.name} name={m.name} primary={m.primary} />
                    ))}
                  </div>
                </div>
              )}
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
