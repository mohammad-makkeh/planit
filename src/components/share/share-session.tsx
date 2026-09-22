'use client'

import { useState } from 'react'
import { Clock, HeartPulse, TrendingUp } from 'lucide-react'
import type { SharedRow, SharedSession } from '@/services/share'
import { MoveLightbox } from './move-lightbox'
import { ShareRowCard } from './share-row-card'

export function ShareSession({ session }: { session: SharedSession }) {
  const [activeRow, setActiveRow] = useState<SharedRow | null>(null)
  const hasCardio =
    session.cardioMinutes !== null || session.cardioBpm !== null || session.cardioIncline !== null
  // Mirrors the PDF: plain lines as a `+`-bulleted grid, highlighted lines as panel strips below.
  const plainLines = session.warmupLines.filter((line) => !line.highlighted)
  const highlightedLines = session.warmupLines.filter((line) => line.highlighted)

  return (
    <div className="space-y-6">
      {session.warmupLines.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Warm-up
          </p>
          {plainLines.length > 0 && (
            <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {plainLines.map((line, i) => (
                <li key={i} className="flex items-baseline gap-2 text-sm leading-snug">
                  <span className="shrink-0 font-semibold text-brand" aria-hidden>
                    +
                  </span>
                  <span>{line.text}</span>
                </li>
              ))}
            </ul>
          )}
          {highlightedLines.length > 0 && (
            <div className="space-y-1.5">
              {highlightedLines.map((line, i) => (
                <div
                  key={i}
                  className="border-l-4 border-brand bg-muted px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wide"
                >
                  {line.text}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {hasCardio && (
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cardio
          </p>
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:gap-5">
            {session.cardioMinutes !== null && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="size-4 shrink-0 text-brand" />
                {session.cardioMinutes} min
              </div>
            )}
            {session.cardioBpm !== null && (
              <div className="flex items-center gap-2 text-sm">
                <HeartPulse className="size-4 shrink-0 text-brand" />
                {session.cardioBpm} BPM
              </div>
            )}
            {session.cardioIncline !== null && (
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="size-4 shrink-0 text-brand" />
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
