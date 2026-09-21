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
import { Textarea } from '@/components/ui/textarea'
import type { SessionFieldPatch } from './plan-editor'
import type { EditorSession } from '@/services/plans'
import type { WarmupPreset } from '@/services/warmups'
import { WarmupPickerSheet } from './warmup-picker-sheet'
import { WarmupSection } from './warmup-section'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const NO_WEEKDAY = 'none'

export function SessionPanel({
  session,
  warmups,
  busy,
  onField,
  onDuplicate,
  onDelete,
  children,
}: {
  session: EditorSession
  warmups: WarmupPreset[]
  busy: boolean
  onField: (fields: SessionFieldPatch) => void
  onDuplicate: () => void
  onDelete: () => void
  children: ReactNode
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

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

      {session.focusNote === null ? (
        <Button variant="ghost" size="sm" onClick={() => onField({ focusNote: '' })}>
          <Plus className="size-4" /> Add focus note
        </Button>
      ) : (
        <div className="flex items-start gap-1 rounded-xl border-l-4 border-brand bg-muted p-3">
          <Textarea
            value={session.focusNote}
            onChange={(e) => onField({ focusNote: e.target.value })}
            placeholder="Session focus…"
            rows={2}
            maxLength={500}
            className="min-h-0 flex-1 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onField({ focusNote: null })}
            aria-label="Remove focus note"
          >
            <X className="size-4 text-muted-foreground" />
          </Button>
        </div>
      )}

      <WarmupSection
        lines={session.warmupLines}
        onChange={(lines) => onField({ warmupLines: lines })}
        onOpenPicker={() => setPickerOpen(true)}
      />

      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workout</p>
        {children}
      </section>

      {session.cardioTime === null && session.cardioHrm === null ? (
        <Button variant="ghost" size="sm" onClick={() => onField({ cardioTime: '', cardioHrm: '' })}>
          <Plus className="size-4" /> Add cardio
        </Button>
      ) : (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cardio</p>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onField({ cardioTime: null, cardioHrm: null })}
              aria-label="Remove cardio"
            >
              <X className="size-4 text-muted-foreground" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={session.cardioTime ?? ''}
              onChange={(e) => onField({ cardioTime: e.target.value })}
              placeholder="Time — e.g. 20 min + 5 cool down"
              maxLength={120}
            />
            <Input
              value={session.cardioHrm ?? ''}
              onChange={(e) => onField({ cardioHrm: e.target.value })}
              placeholder="Heart rate — e.g. 140 BPM incline 8"
              maxLength={120}
            />
          </div>
        </section>
      )}

      <div className="flex gap-2 border-t pt-4">
        <Button variant="outline" size="sm" onClick={onDuplicate} disabled={busy}>
          <Copy className="size-4" /> Duplicate day
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={() => setDeleteOpen(true)}
          disabled={busy}
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
