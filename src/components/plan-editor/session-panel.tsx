'use client'

import { useState, type ReactNode } from 'react'
import { Copy, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { parseIntegerInput } from '@/lib/format'
import type { SessionFieldPatch } from './plan-editor'
import type { EditorSession } from '@/services/plans'
import type { WarmupPreset } from '@/services/warmups'
import { WarmupPickerSheet } from './warmup-picker-sheet'
import { WarmupSection } from './warmup-section'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const NO_WEEKDAY = 'none'

const CARDIO_FIELDS = [
  { key: 'cardioMinutes', label: 'Minutes', min: 1, max: 999 },
  { key: 'cardioBpm', label: 'BPM', min: 1, max: 250 },
  { key: 'cardioIncline', label: 'Incline', min: 0, max: 15 },
] as const

export function SessionPanel({
  session,
  warmups,
  onField,
  onDuplicate,
  onDelete,
  children,
}: {
  session: EditorSession
  warmups: WarmupPreset[]
  onField: (fields: SessionFieldPatch) => void
  onDuplicate: () => void
  onDelete: () => void
  children: ReactNode
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Which session the coach opened an empty cardio block for. Tracked by id (not a boolean) so
  // switching days doesn't carry the open state over — this panel is reused across sessions.
  const [cardioOpenFor, setCardioOpenFor] = useState<string | null>(null)
  const showCardio =
    cardioOpenFor === session.id ||
    session.cardioMinutes !== null ||
    session.cardioBpm !== null ||
    session.cardioIncline !== null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Input
          value={session.label}
          onChange={(e) => onField({ label: e.target.value })}
          aria-label="Session label"
          maxLength={120}
          className="flex-1 font-semibold"
        />
        <Select
          items={[{ value: NO_WEEKDAY, label: 'No weekday' }, ...WEEKDAYS.map((d) => ({ value: d, label: d }))]}
          value={session.weekday ?? NO_WEEKDAY}
          onValueChange={(v) => onField({ weekday: v === NO_WEEKDAY ? null : v })}
        >
          <SelectTrigger className="w-36" aria-label="Weekday">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_WEEKDAY}>No weekday</SelectItem>
            {WEEKDAYS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <WarmupSection
        lines={session.warmupLines}
        onChange={(lines) => onField({ warmupLines: lines })}
        onOpenPicker={() => setPickerOpen(true)}
      />

      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workout</p>
        {children}
      </section>

      {showCardio ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cardio</p>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setCardioOpenFor(null)
                onField({ cardioMinutes: null, cardioBpm: null, cardioIncline: null })
              }}
              aria-label="Remove cardio"
            >
              <X className="size-4 text-muted-foreground" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CARDIO_FIELDS.map(({ key, label, min, max }) => (
              <Input
                key={key}
                type="number"
                inputMode="numeric"
                min={min}
                max={max}
                value={session[key] ?? ''}
                onChange={(e) => onField({ [key]: parseIntegerInput(e.target.value) })}
                placeholder={label}
                aria-label={label}
              />
            ))}
          </div>
        </section>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setCardioOpenFor(session.id)}>
          <Plus className="size-4" /> Add cardio
        </Button>
      )}

      <div className="flex gap-2 border-t pt-4">
        <Button variant="outline" size="sm" onClick={onDuplicate}>
          <Copy className="size-4" /> Duplicate day
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-4" /> Delete day
        </Button>
      </div>

      <WarmupPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        presets={warmups}
        onAdd={(text) => onField({ warmupLines: [...session.warmupLines, { text, highlighted: false }] })}
      />
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {session.label}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the day and all its exercises from the plan.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleteOpen(false)
                onDelete()
              }}
            >
              Delete day
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
