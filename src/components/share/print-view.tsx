'use client'

import { type CSSProperties } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SharedPlan, SharedRow, SharedSession } from '@/services/share'

// A4 print stylesheet, injected once per PrintView instance. `@page` and the print/screen
// media queries can't be expressed as Tailwind utilities, so the whole layout lives here as
// plain CSS keyed off small `pv-` (print-view) class names to avoid colliding with Tailwind.
const PRINT_CSS = `
  @page { size: A4; margin: 0; }

  @media print {
    .no-print { display: none !important; }
  }

  @media screen {
    .pv-screen-bg {
      background: #e5e7eb;
      min-height: 100dvh;
      padding: 32px 0 96px;
    }
    .pv-page {
      margin: 0 auto 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15), 0 12px 28px rgba(0, 0, 0, 0.12);
    }
  }

  .pv-screen-bg {
    color-scheme: light;
  }

  .pv-page {
    width: 210mm;
    min-height: 297mm;
    break-after: page;
    display: flex;
    flex-direction: column;
    background: #ffffff;
    color: #111827;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* :last-of-type (not :last-child) — the print button and this <style> tag are also
     children of .pv-screen-bg, so no .pv-page div is ever the literal last child. */
  .pv-page:last-of-type { break-after: auto; }

  .pv-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8mm;
    background: #111827;
    border-bottom: 3px solid var(--brand);
    color: #ffffff;
    padding: 7mm 10mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pv-header-left {
    display: flex;
    align-items: center;
    gap: 3mm;
    min-width: 0;
  }
  .pv-logo {
    width: 34px;
    height: 34px;
    border-radius: 6px;
    object-fit: cover;
    flex-shrink: 0;
  }
  .pv-coach-name {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
  }
  .pv-coach-title {
    margin: 1px 0 0;
    font-size: 10px;
    color: #9ca3af;
  }
  .pv-header-right {
    text-align: right;
    flex-shrink: 0;
  }
  .pv-client-name {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
  }
  .pv-plan-title {
    margin: 1px 0 0;
    font-size: 10px;
    color: #9ca3af;
  }

  .pv-body {
    flex: 1 1 auto;
    padding: 6mm 10mm 0;
    display: flex;
    flex-direction: column;
    gap: 4mm;
  }

  .pv-day-row {
    display: flex;
    align-items: baseline;
    gap: 3mm;
  }
  .pv-day-label {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
  }
  .pv-day-weekday {
    font-size: 11px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .pv-focus-note {
    margin: 0;
    font-size: 11px;
    background: #f3f4f6;
    border-left: 3px solid var(--brand);
    padding: 2.5mm 3mm;
    border-radius: 2px;
  }

  .pv-section {
    display: flex;
    flex-direction: column;
    gap: 1.5mm;
  }
  .pv-section-title {
    margin: 0;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6b7280;
  }

  .pv-warmup-list {
    display: flex;
    flex-direction: column;
    gap: 1.5mm;
  }
  .pv-warmup-line {
    font-size: 11px;
    padding: 2mm 3mm;
    border-radius: 2px;
    border: 1px solid #e5e7eb;
  }
  .pv-warmup-line--highlight {
    font-weight: 600;
    border: none;
    border-left: 3px solid var(--brand);
    background: color-mix(in srgb, var(--brand) 12%, white);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .pv-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  .pv-table thead th {
    text-align: left;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #6b7280;
    padding: 1.5mm 2mm;
    border-bottom: 1px solid #d1d5db;
  }
  .pv-table tbody td {
    text-align: left;
    vertical-align: top;
    padding: 2mm;
    border-bottom: 1px solid #e5e7eb;
  }
  .pv-table tbody tr:last-child td {
    border-bottom: none;
  }
  .pv-move-name {
    margin: 0;
    font-size: 11.5px;
    font-weight: 600;
  }
  .pv-move-meta {
    margin: 0.5mm 0 0;
    display: flex;
    align-items: center;
    gap: 1.5mm;
    font-size: 9px;
    color: #6b7280;
  }
  .pv-move-equip {
    display: inline-flex;
    align-items: center;
    gap: 1mm;
  }
  .pv-equip-icon {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    object-fit: cover;
    flex-shrink: 0;
  }
  .pv-note-row td {
    padding: 0 2mm 2mm;
    font-size: 10px;
    font-style: italic;
    color: #6b7280;
    border-bottom: 1px solid #e5e7eb;
  }

  .pv-cardio {
    background: #111827;
    color: #ffffff;
    font-size: 11px;
    font-weight: 600;
    padding: 2.5mm 4mm;
    border-radius: 2px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .pv-empty {
    font-size: 12px;
    color: #6b7280;
  }

  .pv-footer {
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid #e5e7eb;
    padding: 3mm 10mm;
    font-size: 9px;
    color: #6b7280;
  }
`

function displayValue(value: string | null): string {
  return value ? value : '—'
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function PageHeader({ plan }: { plan: SharedPlan }) {
  return (
    <div className="pv-header">
      <div className="pv-header-left">
        {plan.coach.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={plan.coach.logoUrl} alt="" className="pv-logo" />
        )}
        <div>
          <p className="pv-coach-name">{plan.coach.name}</p>
          {plan.coach.title && <p className="pv-coach-title">{plan.coach.title}</p>}
        </div>
      </div>
      <div className="pv-header-right">
        <p className="pv-client-name">{plan.client.name}</p>
        <p className="pv-plan-title">{plan.plan.title}</p>
      </div>
    </div>
  )
}

function PageFooter({ plan }: { plan: SharedPlan }) {
  return (
    <div className="pv-footer">
      <span>{plan.coach.name}</span>
      {plan.coach.phone && <span>{plan.coach.phone}</span>}
    </div>
  )
}

function WorkoutTableRow({ row, index }: { row: SharedRow; index: number }) {
  return (
    <>
      <tr>
        <td>
          <p className="pv-move-name">{row.exercise.name}</p>
          <div className="pv-move-meta">
            <span>{capitalize(row.movementType)}</span>
            {row.equipment && (
              <span className="pv-move-equip">
                {row.equipment.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.equipment.imageUrl} alt="" className="pv-equip-icon" />
                )}
                {row.equipment.name}
              </span>
            )}
          </div>
        </td>
        <td>{displayValue(row.sets)}</td>
        <td>{displayValue(row.reps)}</td>
        <td>{displayValue(row.speed)}</td>
        <td>{displayValue(row.oneRm)}</td>
        <td>{displayValue(row.rest)}</td>
      </tr>
      {row.note && (
        <tr className="pv-note-row" key={`${index}-note`}>
          <td colSpan={6}>{row.note}</td>
        </tr>
      )}
    </>
  )
}

function SessionPage({ plan, session }: { plan: SharedPlan; session: SharedSession }) {
  const cardioParts = [session.cardioTime, session.cardioHrm].filter((part): part is string => Boolean(part))
  const cardioLabel = cardioParts.length > 0 ? `CARDIO — ${cardioParts.join(' · ')}` : null

  return (
    <div className="pv-page">
      <PageHeader plan={plan} />
      <div className="pv-body">
        <div className="pv-day-row">
          <h2 className="pv-day-label">{session.label}</h2>
          {session.weekday && <span className="pv-day-weekday">{session.weekday}</span>}
        </div>

        {session.focusNote && <p className="pv-focus-note">{session.focusNote}</p>}

        {session.warmupLines.length > 0 && (
          <section className="pv-section">
            <p className="pv-section-title">Warm-up</p>
            <div className="pv-warmup-list">
              {session.warmupLines.map((line, i) => (
                <div
                  key={i}
                  className={`pv-warmup-line${line.highlighted ? ' pv-warmup-line--highlight' : ''}`}
                >
                  {line.text}
                </div>
              ))}
            </div>
          </section>
        )}

        {session.rows.length > 0 && (
          <section className="pv-section">
            <p className="pv-section-title">Workout</p>
            <table className="pv-table">
              <colgroup>
                <col style={{ width: '36%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Move</th>
                  <th>Sets</th>
                  <th>Reps</th>
                  <th>Speed</th>
                  <th>1RM</th>
                  <th>Rest</th>
                </tr>
              </thead>
              <tbody>
                {session.rows.map((row, i) => (
                  <WorkoutTableRow key={i} row={row} index={i} />
                ))}
              </tbody>
            </table>
          </section>
        )}

        {cardioLabel && <div className="pv-cardio">{cardioLabel}</div>}
      </div>
      <PageFooter plan={plan} />
    </div>
  )
}

export function PrintView({ plan, brand }: { plan: SharedPlan; brand: string }) {
  return (
    <div className="pv-screen-bg" style={{ '--brand': brand } as CSSProperties}>
      <style>{PRINT_CSS}</style>

      {plan.sessions.length > 0 ? (
        plan.sessions.map((session, i) => <SessionPage key={i} plan={plan} session={session} />)
      ) : (
        <div className="pv-page">
          <PageHeader plan={plan} />
          <div className="pv-body">
            <p className="pv-empty">No sessions have been added to this plan yet.</p>
          </div>
          <PageFooter plan={plan} />
        </div>
      )}

      <Button
        type="button"
        onClick={() => window.print()}
        className="no-print fixed right-6 bottom-6 h-11 gap-2 bg-brand px-5 text-brand-foreground shadow-lg hover:bg-brand/90"
      >
        <Printer className="size-4" />
        Print / Save as PDF
      </Button>
    </div>
  )
}
