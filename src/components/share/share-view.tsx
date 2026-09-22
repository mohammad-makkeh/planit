'use client'

import { useState, type CSSProperties } from 'react'
import { EmptyState } from '@/components/shell/empty-state'
import { cn } from '@/lib/utils'
import type { SharedPlan } from '@/services/share'
import { ShareHeader } from './share-header'
import { ShareSession } from './share-session'

export function ShareView({ plan, slug }: { plan: SharedPlan; slug: string }) {
  const [selected, setSelected] = useState(0)
  const session = plan.sessions[selected]

  return (
    <div
      className="min-h-dvh bg-background text-foreground"
      style={{ '--brand': plan.coach.brandColor || '#FE2E00' } as CSSProperties}
    >
      <ShareHeader coach={plan.coach} client={plan.client} slug={slug} />

      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold tracking-tight text-balance">{plan.plan.title}</h1>
      </div>

      {plan.sessions.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none]">
          {plan.sessions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              className={cn(
                'min-h-9 shrink-0 touch-manipulation rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                i === selected
                  ? 'border-brand bg-brand text-brand-foreground'
                  : 'bg-card text-muted-foreground',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <main className="px-4 pt-2 pb-10">
        {session ? (
          <ShareSession key={selected} session={session} />
        ) : (
          <EmptyState
            title="No sessions yet"
            description="Your coach hasn't added any days to this plan."
          />
        )}
      </main>
    </div>
  )
}
