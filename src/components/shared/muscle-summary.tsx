'use client'

import { useState, type ReactNode } from 'react'
import { Maximize2, Plus, X } from 'lucide-react'
import { MuscleMap } from '@/components/shared/muscle-map'
import { MusclePill } from '@/components/shared/muscle-pill'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { formatSets, musclesForRows, shadesForRows, type WorkedRow } from '@/lib/muscle-map'

type SummaryProps = {
  kicker: string
  title: string
  rows: WorkedRow[]
  /** Every muscle name — when given, muscles that get no work at all are called out. */
  catalog?: string[]
}

/**
 * The full view: both figures large with the sets behind their shading. Full-screen on phones,
 * a large centred modal from `sm` up. With `renderGapFix`, each "Not trained" muscle becomes a
 * button that swaps the side panel for whatever it renders (the editor's move suggestions);
 * `back` returns to the breakdown.
 */
export function MuscleSummaryDialog({
  open,
  onOpenChange,
  kicker,
  title,
  rows,
  catalog,
  renderGapFix,
}: SummaryProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  renderGapFix?: (muscle: string, back: () => void) => ReactNode
}) {
  const [gap, setGap] = useState<string | null>(null)
  const muscles = musclesForRows(rows)
  const shades = shadesForRows(rows)
  const worked = new Set(muscles.map((m) => m.name))
  const untrained = catalog?.filter((name) => !worked.has(name)) ?? []
  const label = `${kicker}: ${muscles.map((m) => m.name).join(', ') || 'nothing yet'}`
  const maxSets = muscles[0]?.sets ?? 1

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setGap(null)
        onOpenChange(next)
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 flex h-dvh max-w-none translate-x-0 translate-y-0 flex-col gap-6 rounded-none p-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(90dvh,48rem)] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kicker}</p>
            <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="-mt-1 -mr-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-6 sm:flex-row sm:items-center">
          <MuscleMap shades={shades} label={label} captions className="min-h-0 flex-1 sm:h-full" />
          <div className="max-h-[45%] shrink-0 space-y-5 overflow-y-auto pr-3 sm:max-h-full sm:w-64">
            {gap !== null && renderGapFix ? (
              renderGapFix(gap, () => setGap(null))
            ) : (
              <>
                {muscles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Add moves with muscle targets to see what this works.
                  </p>
                ) : (
                  // Sets per muscle — the numbers behind the figure's shading.
                  <ul className="space-y-2.5">
                    {muscles.map((m) => (
                      <li key={m.name} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="font-medium">{m.name}</span>
                          <span className="text-muted-foreground tabular-nums">{formatSets(m.sets)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${(m.sets / maxSets) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {muscles.length > 0 && untrained.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Not trained
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {untrained.map((name) =>
                        renderGapFix ? (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setGap(name)}
                            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-dashed border-input px-3 text-xs font-medium text-muted-foreground outline-none hover:border-brand hover:text-brand focus-visible:ring-2 focus-visible:ring-ring/50"
                          >
                            <Plus className="size-3.5" aria-hidden />
                            {name}
                          </button>
                        ) : (
                          <MusclePill key={name} name={name} primary={false} />
                        ),
                      )}
                    </div>
                    {renderGapFix && (
                      <p className="text-xs text-muted-foreground">Tap one to add a move that trains it.</p>
                    )}
                  </div>
                )}
                {muscles.length > 0 && (
                  <p className="text-xs text-muted-foreground">Secondary muscles count as half a set.</p>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * A card with the shaded figure and the muscles the rows work, busiest first (the share page's
 * "Today hits"). Tapping it opens `MuscleSummaryDialog`. Renders nothing when no muscle is worked.
 */
export function MuscleSummary(props: SummaryProps) {
  const [open, setOpen] = useState(false)
  const muscles = musclesForRows(props.rows)
  if (muscles.length === 0) return null

  const label = `${props.kicker}: ${muscles.map((m) => m.name).join(', ')}`

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${label}. Open full view`}
        className="relative flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-accent/40"
      >
        <MuscleMap shades={shadesForRows(props.rows)} label={label} className="h-32" />
        <div className="min-w-0 space-y-2 pr-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {props.kicker}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {muscles.map((m) => (
              <MusclePill key={m.name} name={m.name} />
            ))}
          </div>
        </div>
        <Maximize2 className="absolute top-3 right-3 size-4 text-muted-foreground" aria-hidden />
      </button>
      <MuscleSummaryDialog {...props} open={open} onOpenChange={setOpen} />
    </>
  )
}
