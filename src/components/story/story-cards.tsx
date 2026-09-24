/* eslint-disable @next/next/no-img-element -- Satori draws these into a PNG; no <img> reaches a page */
import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ReactElement } from 'react'
import type { LogoImage } from '@/lib/coach-brand'
import { FOCUS_TITLE, dayFocus, featuredMuscles, focusSlogan } from '@/lib/day-focus'
import {
  BACK_BODY, BODY_VIEWBOX, FRONT_BODY, shadeOpacity, shadesForRows, type RegionShades, type RegionShape,
} from '@/lib/muscle-map'
import type { StoryDesign } from '@/lib/story'
import type { SharedPlan, SharedSession } from '@/services/share'

/**
 * The share page's story cards: 1080×1920 PNGs a client posts to their Instagram story, drawn by
 * Satori in `app/(public)/p/[slug]/story/[design]/[day]/route.tsx`. Every word on a card comes
 * from the day's moves (`lib/day-focus`), never from the label the coach typed.
 */
export const STORY = { width: 1080, height: 1920 }
/** Instagram covers roughly the top 250px (progress bar, profile) and bottom 340px (reply bar). */
const SAFE_TOP = 250
const SAFE_BOTTOM = 340

// Traced into the story route by `outputFileTracingIncludes` in next.config.ts.
const FONT_DIR = join(process.cwd(), 'src/pdf-fonts')
const font = (name: string, file: string, weight: 400 | 500 | 700 | 800 = 400) =>
  readFile(file).then((data) => ({ name, data, weight, style: 'normal' as const }))
export const storyFonts = Promise.all([
  font('Inter', join(FONT_DIR, 'Inter-500.ttf'), 500),
  font('Inter', join(FONT_DIR, 'Inter-800.ttf'), 800),
  font('Anton', join(FONT_DIR, 'Anton-Regular.ttf')),
  font('Marker', join(FONT_DIR, 'PermanentMarker-Regular.ttf')),
])

export type StoryInput = {
  plan: SharedPlan
  session: SharedSession
  brand: string
  logo: LogoImage | null
  /** "SEP 24" — the client's today, from their phone. */
  date: string
}

/* ---------------------------------------------------------------- helpers */

function rgb(hex: string): [number, number, number] {
  let h = hex.slice(1)
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgba(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function logoSrc(logo: LogoImage): string {
  return `data:image/${logo.format === 'jpg' ? 'jpeg' : 'png'};base64,${logo.data.toString('base64')}`
}

/** Everything the cards say about the day, read from its moves — never from its label. */
function copy(session: SharedSession) {
  const focus = dayFocus(session.rows, session.cardioMinutes)
  const title = FOCUS_TITLE[focus]
  return {
    title,
    /** "Push day", "Glutes day", "Grind day". */
    headline: `${title} day`,
    slogan: focusSlogan(focus, session.rows),
    muscles: (count: number) => featuredMuscles(session.rows, count),
  }
}

function Figure({
  shapes, shades, worked, rest, restOpacity, height, glow,
}: {
  shapes: RegionShape[]
  shades: RegionShades
  worked: string
  rest: string
  restOpacity: number
  height: number
  /** Draws a blurred copy of the worked muscles behind the figure. */
  glow?: string
}) {
  const polygons = (blurred: boolean) =>
    shapes.map(({ region, points }) => {
      const shade = shades[region]
      if (blurred && shade === undefined) return null
      return points.map((p, i) => (
        <polygon
          key={`${blurred ? 'g' : 'f'}-${region}-${i}`}
          points={p}
          fill={blurred ? glow : shade === undefined ? rest : worked}
          fillOpacity={blurred ? 0.9 : shade === undefined ? restOpacity : shadeOpacity(shade)}
        />
      ))
    })
  return (
    <svg viewBox={BODY_VIEWBOX} width={height / 2} height={height} style={{ overflow: 'visible' }}>
      {glow && (
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>
      )}
      {glow && <g filter="url(#glow)">{polygons(true)}</g>}
      {polygons(false)}
    </svg>
  )
}

function Bodies(props: Omit<Parameters<typeof Figure>[0], 'shapes'> & { gap: number }) {
  const { gap, ...figure } = props
  return (
    <div style={{ display: 'flex', gap }}>
      <Figure shapes={FRONT_BODY} {...figure} />
      <Figure shapes={BACK_BODY} {...figure} />
    </div>
  )
}

/* -------------------------------------------------------------------- Tape */

/** Repeats `items` joined by bullets until the run is long enough to overflow a full-bleed band. */
function run(items: string[], minLength = 120): string {
  const unit = items.map((i) => i.toUpperCase()).join('   •   ')
  let text = unit
  while (text.length < minLength) text += `   •   ${unit}`
  return text
}

function Tape({ plan, session, brand, logo, date }: StoryInput) {
  const shades = shadesForRows(session.rows)
  const { title, headline, slogan, muscles } = copy(session)
  const worked = muscles(4)
  // As big as the width allows: "LEGS DAY" is huge, "UPPER BODY DAY" still fits one line.
  const headlineSize = Math.min(180, Math.floor(2150 / headline.length))
  const wall = Array(4).fill(title.toUpperCase()).join(' ')
  const tape = (text: string, bg: string, fg: string, top: number, rotate: number) => (
    <div
      style={{
        position: 'absolute', left: -200, top, width: 1480, display: 'flex', overflow: 'hidden',
        transform: `rotate(${rotate}deg)`, backgroundColor: bg, color: fg, padding: '18px 0 26px',
        fontSize: 64, whiteSpace: 'nowrap', boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
      }}
    >
      {text}
    </div>
  )
  const coachLine = `COACHED BY ${plan.coach.name.toUpperCase()}`
  return (
    <div
      style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'relative', overflow: 'hidden', backgroundColor: '#0A0A0A', fontFamily: 'Anton', color: '#FFFFFF',
      }}
    >
      {/* The day's focus stacked edge to edge as a ghosted wall of type behind everything. */}
      <div style={{ position: 'absolute', top: 120, left: -40, display: 'flex', flexDirection: 'column' }}>
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            style={{
              display: 'flex', fontSize: 300, lineHeight: 0.9, whiteSpace: 'nowrap',
              color: i % 2 ? 'rgba(255,255,255,0.05)' : rgba(brand, 0.16),
            }}
          >
            {wall}
          </div>
        ))}
      </div>

      {/* Says in plain words what the post is: today's workout. */}
      <div style={{ position: 'absolute', top: 440, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', fontFamily: 'Marker', fontSize: 58, color: '#FFFFFF', transform: 'rotate(-4deg)' }}>
          today&apos;s workout
        </div>
        <div
          style={{
            display: 'flex', fontSize: headlineSize, lineHeight: 1, marginTop: 4, color: '#FFFFFF',
            textShadow: `0 0 40px ${rgba(brand, 0.6)}, 6px 6px 0 ${brand}`,
          }}
        >
          {headline.toUpperCase()}
        </div>
      </div>

      <div style={{ position: 'absolute', top: 730, display: 'flex' }}>
        <Bodies shades={shades} worked={brand} rest="#262626" restOpacity={1} height={660} gap={40} glow={brand} />
      </div>

      {/* A date stamp, slightly crooked, like it was inked on. */}
      <div
        style={{
          position: 'absolute', top: 1090, right: 56, width: 230, height: 230, borderRadius: 999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          border: `6px solid ${brand}`, backgroundColor: 'rgba(10,10,10,0.85)', color: brand,
          transform: 'rotate(-12deg)',
        }}
      >
        <div style={{ display: 'flex', fontFamily: 'Inter', fontWeight: 800, fontSize: 26, letterSpacing: 6 }}>TODAY</div>
        <div style={{ display: 'flex', fontSize: 72, lineHeight: 1, marginTop: 4 }}>{date}</div>
      </div>

      {/* A day with no muscles to name (cardio, an empty day) tapes its focus instead. */}
      {tape(run(worked.length > 0 ? worked : [title]), brand, '#0A0A0A', 280, -7)}
      {tape(run([slogan]), '#FFFFFF', '#0A0A0A', 1420, 6)}

      <div
        style={{
          position: 'absolute', bottom: SAFE_BOTTOM - 60, display: 'flex', alignItems: 'center', gap: 20,
          maxWidth: 940, fontFamily: 'Inter', fontWeight: 800, letterSpacing: 4,
          fontSize: coachLine.length > 30 ? 24 : 30,
        }}
      >
        {logo && <img alt="" src={logoSrc(logo)} style={{ height: 52 }} />}
        <div style={{ display: 'block', lineClamp: 1 }}>{coachLine}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- Cover */

const MASTHEAD_TOP = 360
const MASTHEAD_WIDTH = 1900
/** The cover figure's centre line and the lowest its feet may reach (above the footer). */
const FIGURE_CENTER = 610
const FIGURE_BOTTOM = 1530

/**
 * The masthead as big as the width allows: one line for a single word ("LEGS" gets huge,
 * "SHOULDERS" still fits), two lines for a two-word title so "UPPER BODY" doesn't shrink to a
 * caption. Sizes are Anton's average glyph width worked back from the 952px content box.
 */
function masthead(title: string): { lines: string[]; size: number } {
  const words = title.toUpperCase().split(' ')
  if (words.length > 1 && title.length > 7) {
    return { lines: words, size: Math.min(340, Math.floor(MASTHEAD_WIDTH / Math.max(...words.map((w) => w.length)))) }
  }
  return { lines: [words.join(' ')], size: Math.min(480, Math.floor(MASTHEAD_WIDTH / Math.max(title.length, 3))) }
}

/** The slogan badge is a fixed circle; long lines step down so they wrap to three lines at most. */
function badgeSize(slogan: string): number {
  if (slogan.length <= 12) return 54
  if (slogan.length <= 18) return 46
  if (slogan.length <= 24) return 40
  return 34
}

function Cover({ plan, session, brand, logo, date }: StoryInput) {
  const shades = shadesForRows(session.rows)
  const { title, slogan, muscles } = copy(session)
  // A cardio day works no muscles on the map, so its cover lines are about the engine instead.
  const lines = session.rows.length === 0 && session.cardioMinutes ? ['Heart', 'Lungs', 'Willpower'] : muscles(3)
  const head = masthead(title)
  const mastheadBottom = MASTHEAD_TOP + head.lines.length * head.size * 0.9
  const coverLinesTop = Math.max(700, mastheadBottom + 50)
  // One line: the figure overlaps its lower edge. Two lines: it starts halfway into the second
  // line so "BODY" stays readable, and shrinks to keep its feet clear of the footer.
  const figureTop = head.lines.length > 1 ? mastheadBottom - head.size * 0.45 : 600
  const figureHeight = Math.min(960, FIGURE_BOTTOM - figureTop)
  const INK = '#111111'
  const bars = [4, 2, 6, 2, 3, 8, 2, 4, 2, 6, 3, 2, 5, 2, 7, 3, 2, 4, 6, 2, 3]
  return (
    <div
      style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative',
        backgroundColor: '#F2EDE4', color: INK, fontFamily: 'Anton', overflow: 'hidden',
        padding: `${SAFE_TOP - 30}px 64px 0`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', fontFamily: 'Inter', fontWeight: 800, fontSize: 26, letterSpacing: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, maxWidth: 952 }}>
          {logo && <img alt="" src={logoSrc(logo)} style={{ height: 44 }} />}
          <div style={{ display: 'block', lineClamp: 1 }}>{`COACHED BY ${plan.coach.name.toUpperCase()}`}</div>
        </div>
      </div>

      {/* A tilted label on the masthead's top edge: this cover is today's workout. It sits in the
          flow above the title, so it never hides a letter of a short one ("CHEST"). */}
      <div
        style={{
          display: 'flex', alignSelf: 'flex-start', marginTop: 22, transform: 'rotate(-3deg)',
          backgroundColor: INK, color: '#FFE14D', fontSize: 46, padding: '6px 22px 12px',
          boxShadow: '6px 6px 0 rgba(0,0,0,0.18)',
        }}
      >
        TODAY&apos;S WORKOUT
      </div>

      {/* The masthead sits behind the figure, the way a cover model overlaps the title. */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: -6, color: brand }}>
        {head.lines.map((line) => (
          <div key={line} style={{ display: 'flex', fontSize: head.size, lineHeight: 0.9, letterSpacing: -4 }}>
            {line}
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', top: figureTop, left: FIGURE_CENTER - figureHeight / 4, display: 'flex' }}>
        <Figure shapes={FRONT_BODY} shades={shades} worked={brand} rest={INK} restOpacity={0.92} height={figureHeight} />
      </div>

      {lines.length > 0 && (
        <div style={{ position: 'absolute', top: coverLinesTop, left: 64, display: 'flex', flexDirection: 'column', width: 360 }}>
          <div style={{ display: 'flex', fontFamily: 'Marker', fontSize: 40, color: brand }}>today we hit</div>
          {lines.map((m, i) => (
            <div
              key={m}
              style={{
                display: 'flex', lineHeight: 0.95, marginTop: 14,
                // Sized down by the longest word so "SHOULDER" never runs into the figure.
                fontSize: Math.min([104, 76, 60][i]!, Math.floor(680 / Math.max(...m.split(' ').map((w) => w.length)))),
                color: i === 1 ? brand : INK,
              }}
            >
              {m.toUpperCase()}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          position: 'absolute', top: 1130, right: 44, width: 290, height: 290, borderRadius: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          backgroundColor: '#FFE14D', border: `6px solid ${INK}`, transform: 'rotate(12deg)',
          fontFamily: 'Marker', fontSize: badgeSize(slogan), lineHeight: 1.05, padding: 30,
        }}
      >
        {slogan}
      </div>

      <div
        style={{
          position: 'absolute', bottom: SAFE_BOTTOM - 40, left: 64, right: 64, display: 'flex',
          justifyContent: 'space-between', alignItems: 'flex-end',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 640, fontFamily: 'Inter', fontWeight: 800, fontSize: 24, letterSpacing: 3 }}>
          <div style={{ display: 'flex' }}>{`THE ${title.toUpperCase()} ISSUE`}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontWeight: 500, color: 'rgba(17,17,17,0.6)', marginTop: 6 }}>
            {/* The client's name gives way before the date does. */}
            <div style={{ display: 'block', lineClamp: 1, minWidth: 0 }}>{`Programmed for ${plan.client.name}`}</div>
            <div style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: 'rgba(17,17,17,0.3)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexShrink: 0 }}>{date}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, backgroundColor: '#FFFFFF', padding: '12px 14px' }}>
          {bars.map((w, i) => (
            <div key={i} style={{ width: w, height: 70, backgroundColor: i % 2 ? '#FFFFFF' : INK }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export const STORY_CARDS: Record<StoryDesign, (input: StoryInput) => ReactElement> = {
  tape: (input) => <Tape {...input} />,
  cover: (input) => <Cover {...input} />,
}
