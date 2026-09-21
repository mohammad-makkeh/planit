'use client'

import { Blobatar } from '@blobatar/react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

export type PickerClient = { id: string; name: string }

export function ClientPickerDialog({
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Copy plan to…</DialogTitle>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  )
}
