'use client'

import { Check, Dumbbell } from 'lucide-react'
import {
  BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle,
} from '@/components/ui/bottom-sheet'

export function RowEquipmentSheet({
  open,
  onOpenChange,
  moveName,
  equipment,
  defaultEquipmentId,
  selectedId,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  moveName: string
  equipment: { id: string; name: string; imageUrl: string | null }[]
  defaultEquipmentId: string
  selectedId: string | null
  onSelect: (equipmentId: string | null) => void
}) {
  const resolvedSelectedId = selectedId ?? defaultEquipmentId

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>Equipment — {moveName}</BottomSheetTitle>
        </BottomSheetHeader>
        <div className="space-y-1.5">
          {equipment.map((item) => {
            const isDefault = item.id === defaultEquipmentId
            const isSelected = item.id === resolvedSelectedId
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(isDefault ? null : item.id)
                  onOpenChange(false)
                }}
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-2.5 text-left hover:bg-accent/40"
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="size-9 rounded-lg border object-cover" />
                ) : (
                  <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                    <Dumbbell className="size-4 text-muted-foreground" />
                  </div>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {item.name}
                  {isDefault && <span className="text-muted-foreground"> · default</span>}
                </span>
                {isSelected && <Check className="size-4 shrink-0 text-brand" />}
              </button>
            )
          })}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  )
}
