'use client'

import { useState, type CSSProperties } from 'react'
import { Flame } from 'lucide-react'
import { EmptyState } from '@/components/shell/empty-state'
import { FOCUS_TITLE, dayFocus } from '@/lib/day-focus'
import { cn } from '@/lib/utils'
import type { SharedPlan } from '@/services/share'
import { ShareHeader } from './share-header'
import { ShareSession } from './share-session'
import { StorySheet } from './story-sheet'

export function ShareView({ plan, slug }: { plan: SharedPlan; slug: string }) {
  const [selected, setSelected] = useState(0)
  const [storyOpen, setStoryOpen] = useState(false)
  const session = plan.sessions[selected]
  const brand = plan.coach.brandColor || '#FE2E00'
  const headline = session ? `${FOCUS_TITLE[dayFocus(session.rows, session.cardioMinutes)]} day` : ''

  return (
    <div
      className="min-h-dvh bg-background text-foreground"
      style={{ '--brand': brand } as CSSProperties}
    >
      <ShareHeader coach={plan.coach} client={plan.client} slug={slug} />

      {/* Capped and centred: plan content gains nothing from a wide monitor's full width. */}
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-3 px-4 pt-4">
          <h1 className="min-w-0 pt-1 text-xl font-bold tracking-tight text-balance">{plan.plan.title}</h1>
          {session && (
            // Turns the selected day into an Instagram story card.
            <button
              type="button"
              onClick={() => setStoryOpen(true)}
              // Brand tint like a primary muscle pill, so it doesn't read as another selected day chip.
              className="inline-flex h-9 shrink-0 touch-manipulation items-center gap-1.5 rounded-full bg-brand/10 px-4 text-sm font-semibold text-brand outline-none transition-colors hover:bg-brand/15 focus-visible:ring-2 focus-visible:ring-brand/50"
            >
              <Flame className="size-4" aria-hidden />
              Flex it
            </button>
          )}
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

      <StorySheet
        open={storyOpen}
        onOpenChange={setStoryOpen}
        slug={slug}
        dayIndex={selected}
        headline={headline}
        clientName={plan.client.name}
        brand={brand}
        version={String(Math.max(plan.plan.updatedAt.getTime(), plan.coach.updatedAt.getTime()))}
      />
    </div>
  )
}
