import { FileDown } from 'lucide-react'
import type { SharedPlan } from '@/services/share'

/**
 * Mirrors the PDF header (`src/components/pdf/plan-pdf.tsx` `PageHeader`) so a coach's client
 * sees one identity across the web page and the downloaded file: dark band, brand-coloured
 * bottom border, coach block left (logo + name + title), client block right with a small
 * letterspaced uppercase `CLIENT` kicker above the client name. Adapted to a responsive web
 * layout — the PDF's fixed A4 geometry becomes a stack that holds up at 390px.
 */
export function ShareHeader({
  coach,
  client,
  slug,
}: {
  coach: SharedPlan['coach']
  client: SharedPlan['client']
  slug: string
}) {
  return (
    <header className="border-b-4 bg-[#0f0f0f]" style={{ borderBottomColor: 'var(--brand)' }}>
      <div className="flex px-4 pt-3">
        {/* Top-left per the coach's request — a small icon-only download, not the old full-width button. */}
        <a
          href={`/p/${slug}/pdf`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white outline-none transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <FileDown className="size-3.5 shrink-0" aria-hidden />
          PDF
        </a>
      </div>
      <div className="flex items-start justify-between gap-4 px-4 pt-3 pb-4">
        {/* Logo stacks above the coach's name below `sm` — a wide, non-square logo would
            otherwise fight the name/title for the little width a 390px viewport has left. */}
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
          {coach.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coach.logoUrl}
              alt=""
              // Height only, never width or object-cover — constraining both axes is what
              // cropped the logo before. `max-w-full` is a proportional safety net (still via
              // object-contain, so it can only shrink the logo, never crop or squash it).
              className="h-9 w-auto max-w-full shrink-0 object-contain"
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-extrabold tracking-wide text-white">
              {coach.name}
            </p>
            {coach.title && (
              <p className="mt-0.5 truncate text-[10px] font-medium tracking-[0.12em] text-white/60 uppercase">
                {coach.title}
              </p>
            )}
          </div>
        </div>
        <div className="max-w-[45%] shrink-0 text-right">
          <p
            className="text-[10px] font-semibold tracking-[0.25em] uppercase"
            style={{ color: 'var(--brand)' }}
          >
            Client
          </p>
          <p className="mt-1 text-sm leading-snug font-bold text-white">{client.name}</p>
        </div>
      </div>
    </header>
  )
}
