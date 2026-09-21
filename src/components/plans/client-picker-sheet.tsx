'use client'

import { Blobatar } from '@blobatar/react'
import {
  BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle,
} from '@/components/ui/bottom-sheet'

export type PickerClient = { id: string; name: string }

export function ClientPickerSheet({
  open,
  onOpenChange,
  clients,
  excludeClientId,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: PickerClient[]
  excludeClientId: string
  onPick: (clientId: string) => void
}) {
  const options = clients.filter((c) => c.id !== excludeClientId)
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>Copy plan to…</BottomSheetTitle>
        </BottomSheetHeader>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other clients yet.</p>
        ) : (
          <div className="space-y-1">
            {options.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onPick(c.id)}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-accent/50"
              >
                <div className="shrink-0">
                  <Blobatar name={c.name} size={36} />
                </div>
                <span className="font-medium">{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </BottomSheetContent>
    </BottomSheet>
  )
}
