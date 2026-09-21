'use client'

import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createWarmupAction } from '@/actions/warmups'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WarmupPreset } from '@/services/warmups'
import {
  BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle,
} from '@/components/ui/bottom-sheet'

export function WarmupPickerSheet({
  open,
  onOpenChange,
  presets,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  presets: WarmupPreset[]
  onAdd: (text: string) => void
}) {
  const [freeText, setFreeText] = useState('')
  const [saveToPresets, setSaveToPresets] = useState(false)
  const [addedTexts, setAddedTexts] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function addPreset(text: string) {
    onAdd(text)
    setAddedTexts((prev) => [...prev, text])
  }

  async function addFreeText() {
    const text = freeText.trim()
    if (!text) return
    onAdd(text)
    setAddedTexts((prev) => [...prev, text])
    setFreeText('')
    if (saveToPresets) {
      setSaving(true)
      const result = await createWarmupAction({ text })
      setSaving(false)
      if (!result.ok) toast.error(result.error.message)
      else toast.success('Saved to your warm-ups')
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>Add warm-up</BottomSheetTitle>
        </BottomSheetHeader>
        <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Write a warm-up line…"
              maxLength={300}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void addFreeText()
                }
              }}
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => void addFreeText()}
              disabled={saving || !freeText.trim()}
              aria-label="Add warm-up line"
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={saveToPresets}
              onChange={(e) => setSaveToPresets(e.target.checked)}
              className="size-3.5 accent-[var(--color-brand)]"
            />
            Also save to my warm-ups
          </label>
        </div>
        {presets.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your warm-ups
            </p>
            {presets.map((p) => {
              const added = addedTexts.includes(p.text)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addPreset(p.text)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border bg-card p-3 text-left text-sm hover:bg-accent/40"
                >
                  <span className="min-w-0 flex-1">{p.text}</span>
                  {added ? (
                    <Check className="size-4 shrink-0 text-brand" />
                  ) : (
                    <Plus className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              )
            })}
          </div>
        )}
        <Button className="w-full" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </div>
      </BottomSheetContent>
    </BottomSheet>
  )
}
