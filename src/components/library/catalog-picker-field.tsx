'use client'

import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  BottomSheetContent, BottomSheetHeader, BottomSheetNested, BottomSheetTitle,
} from '@/components/ui/bottom-sheet'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** An entry of a global catalog (muscle targets, equipment) — edited in the database only. */
export type CatalogOption = { id: string; name: string; imageUrl?: string | null }
export type EquipmentOption = CatalogOption & { isFallback: boolean }

function OptionIcon({ option }: { option: CatalogOption }) {
  if (!option.imageUrl) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={option.imageUrl} alt="" className="size-4 shrink-0 rounded-sm object-contain" />
}

/**
 * Picked catalog entries as removable pills, plus an "Add" pill that opens a nested sheet
 * listing the whole catalog. Order is the order picked (for equipment, the first pick is the
 * move's default). Must render inside a `BottomSheet`, which the nested sheet stacks on.
 */
export function CatalogPickerField({
  label,
  sheetTitle,
  options,
  value,
  onChange,
  showIcons = false,
  secondaryIds,
  onToggleSecondary,
  error,
}: {
  label: string
  sheetTitle: string
  options: CatalogOption[]
  value: string[]
  onChange: (ids: string[]) => void
  showIcons?: boolean
  /** With `onToggleSecondary`: picked ids shown as secondary; tapping a pill's name toggles. */
  secondaryIds?: string[]
  onToggleSecondary?: (id: string) => void
  error?: string
}) {
  const [open, setOpen] = useState(false)
  const byId = new Map(options.map((o) => [o.id, o]))
  const picked = value.flatMap((id) => byId.get(id) ?? [])

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {picked.map((option) => {
          const secondary = secondaryIds?.includes(option.id) ?? false
          return (
            <span
              key={option.id}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border pr-1 text-sm font-medium',
                onToggleSecondary ? 'pl-0' : 'pl-3',
                onToggleSecondary && !secondary
                  ? 'border-transparent bg-brand/10 text-brand'
                  : 'border-input bg-background',
                secondary && 'text-muted-foreground',
              )}
            >
              {showIcons && <OptionIcon option={option} />}
              {onToggleSecondary ? (
                <button
                  type="button"
                  onClick={() => onToggleSecondary(option.id)}
                  aria-pressed={!secondary}
                  aria-label={`${option.name}: ${secondary ? 'secondary' : 'primary'}. Tap to switch`}
                  className="flex h-full cursor-pointer items-center rounded-l-full pl-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {option.name}
                </button>
              ) : (
                option.name
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== option.id))}
                aria-label={`Remove ${option.name}`}
                className={cn(
                  'flex size-7 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  // Follows the pill: brand on a primary muscle, muted everywhere else.
                  onToggleSecondary && !secondary
                    ? 'text-brand hover:bg-brand/15'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                <X className="size-3.5" />
              </button>
            </span>
          )
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-input px-3 text-sm font-medium text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Plus className="size-4" /> Add
        </button>
      </div>
      {onToggleSecondary && picked.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Tap a muscle to switch it between primary (orange) and secondary (grey).
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <BottomSheetNested open={open} onOpenChange={setOpen}>
        <BottomSheetContent
          footer={
            <Button type="button" className="w-full" onClick={() => setOpen(false)}>
              Done
            </Button>
          }
        >
          <BottomSheetHeader>
            <BottomSheetTitle>{sheetTitle}</BottomSheetTitle>
          </BottomSheetHeader>
          <div className="space-y-1">
            {options.map((option) => {
              const selected = value.includes(option.id)
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggle(option.id)}
                  aria-pressed={selected}
                  className="flex w-full items-center gap-2.5 rounded-xl border bg-card p-3 text-left text-sm hover:bg-accent/40"
                >
                  {showIcons && <OptionIcon option={option} />}
                  <span className="min-w-0 flex-1">{option.name}</span>
                  {selected ? (
                    <Check className="size-4 shrink-0 text-brand" />
                  ) : (
                    <Plus className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              )
            })}
          </div>
        </BottomSheetContent>
      </BottomSheetNested>
    </div>
  )
}
