'use client'

import { useState } from 'react'
import { Angle, Clock, HeartPulse } from 'lucide-react'
import { MuscleSummary } from '@/components/shared/muscle-summary'
import type { SharedRow, SharedSession } from '@/services/share'
import { MoveLightbox } from './move-lightbox'
import { ShareRowCard } from './share-row-card'

export function ShareSession({ session }: { session: SharedSession }) {
  const [activeRow, setActiveRow] = useState<SharedRow | null>(null)
  const hasCardio =
    session.cardioMinutes !== null || session.cardioBpm !== null || session.cardioIncline !== null

  return (
    <div className="space-y-6">
      <MuscleSummary
        kicker="Today hits"
        title={session.label}
        rows={session.rows.map((row) => ({ muscles: row.muscles, sets: row.sets }))}
      />

      {session.warmupLines.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Warm-up
          </p>
          {/* Mirrors the PDF: a `+`-bulleted grid. */}
          <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {session.warmupLines.map((line, i) => (
              <li key={i} className="flex items-baseline gap-2 text-sm leading-snug">
                <span className="shrink-0 font-semibold text-brand" aria-hidden>
                  +
                </span>
                <span>{line.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasCardio && (
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cardio
          </p>
          {/* One row at every width: equal cells split by full-height dividers; the box has no
              padding of its own, so the dividers run edge to edge. */}
          <div className="flex divide-x rounded-xl border bg-card">
            {session.cardioMinutes !== null && (
              <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-2 py-3 text-sm">
                <Clock className="size-4 shrink-0 text-brand" />
                {session.cardioMinutes} min
              </div>
            )}
            {session.cardioBpm !== null && (
              <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-2 py-3 text-sm">
                <HeartPulse className="size-4 shrink-0 text-brand" />
                {session.cardioBpm} BPM
              </div>
            )}
            {session.cardioIncline !== null && (
              <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-2 py-3 text-sm">
                <Angle className="size-4 shrink-0 text-brand" />
                {session.cardioIncline}%
              </div>
            )}
          </div>
        </section>
      )}

      {session.rows.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Workout
          </p>
          <div className="space-y-2">
            {session.rows.map((row, i) => (
              <ShareRowCard key={i} row={row} onOpen={() => setActiveRow(row)} />
            ))}
          </div>
        </section>
      )}

      <MoveLightbox
        row={activeRow}
        open={activeRow !== null}
        onOpenChange={(open) => { if (!open) setActiveRow(null) }}
      />
    </div>
  )
}
