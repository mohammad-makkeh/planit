'use client'

import {
  BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle,
} from '@/components/ui/bottom-sheet'
import type { SharedRow } from '@/services/share'
import { MoveDetails } from './move-details'

/** The share page's move sheet: `MoveDetails` in a vaul bottom sheet, titled with the move. */
export function MoveLightbox({
  row,
  open,
  onOpenChange,
}: {
  row: SharedRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        {row && (
          <>
            <BottomSheetHeader>
              <BottomSheetTitle>{row.exercise.name}</BottomSheetTitle>
            </BottomSheetHeader>
            <MoveDetails row={row} />
          </>
        )}
      </BottomSheetContent>
    </BottomSheet>
  )
}
