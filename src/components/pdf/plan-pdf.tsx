import 'server-only'
import {
  Document, Image, Page, Polygon, StyleSheet, Svg, Text, View, renderToBuffer,
} from '@react-pdf/renderer'
import type { Style } from '@react-pdf/stylesheet'
import {
  BACK_BODY, BODY_VIEWBOX, FRONT_BODY, busiestSide, focusViewBox, shadeOpacity, shadesForMove,
  shadesForRows, type RegionShades, type RegionShape,
} from '@/lib/muscle-map'
import type { SharedPlan, SharedRow, SharedSession } from '@/services/share'
import { FONT_BODY, FONT_DISPLAY, FONT_LABEL } from './fonts'

/**
 * The plan as a real PDF, laid out after `docs/reference/original-plan-template.html`.
 *
 * That template is CSS in millimetres; react-pdf works in PostScript points, so every
 * measurement below goes through `mm()` (1mm = 72/25.4 pt) and the type sizes — which the
 * template already expressed in pt — carry over unchanged. A4 is 595.28 x 841.89pt.
 */
const mm = (value: number) => value * (72 / 25.4)

const INK = '#111111'
const INK_SOFT = '#555555'
const INK_FAINT = '#9A9A9A'
const DARK = '#0F0F0F'
const LINE = '#E8E8E8'
const PANEL = '#F6F6F6'
const WHITE = '#FFFFFF'
const DEFAULT_BRAND = '#FE2E00'

const PAGE_GUTTER = mm(12)
const HEADER_HEIGHT = mm(27)
const FOOTER_HEIGHT = mm(12)
const BODY_TOP_GAP = mm(9)

/** Column widths, template proportions re-dealt to the app's field order. Sums to 100%. */
const COL = {
  exercise: { width: '34%' },
  sets: { width: '8%' },
  reps: { width: '8%' },
  rest: { width: '16%' },
  speed: { width: '18%' },
  oneRm: { width: '16%' },
} satisfies Record<string, Style>

const styles = StyleSheet.create({
  // The band and the rule are absolute and `fixed`, so the page padding — not the flow —
  // reserves their space. A session long enough to wrap therefore starts its second page at
  // exactly the same offset as its first, instead of tucking up under the header.
  page: {
    backgroundColor: WHITE,
    color: INK,
    fontFamily: FONT_BODY,
    fontWeight: 400,
    paddingTop: HEADER_HEIGHT + BODY_TOP_GAP,
    paddingBottom: FOOTER_HEIGHT,
    paddingHorizontal: PAGE_GUTTER,
  },

  /* ---------- Header ---------- */
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    backgroundColor: DARK,
    borderBottomWidth: mm(1.4),
    borderBottomStyle: 'solid',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE_GUTTER,
    overflow: 'hidden',
  },
  coachBlock: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, paddingRight: mm(6) },
  // Height only, never width: constraining both axes is what squashed the logo before.
  logo: { height: mm(9.5) },
  coachText: { flexShrink: 1, marginLeft: mm(5) },
  coachName: { fontSize: 12.5, fontWeight: 800, color: WHITE, letterSpacing: 0.25 },
  coachTitle: {
    fontSize: 7.5,
    color: '#ABABAB',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: mm(1),
  },
  clientBlock: { maxWidth: mm(80), flexShrink: 0 },
  clientLabel: { fontFamily: FONT_LABEL, fontSize: 8.5, letterSpacing: 1.87, textAlign: 'right' },
  clientName: {
    fontSize: 13.5,
    fontWeight: 700,
    color: WHITE,
    marginTop: mm(1),
    textAlign: 'right',
    lineHeight: 1.15,
  },

  // Figures sit on the title's baseline rather than floating mid-banner.
  dayBanner: { marginBottom: mm(7), flexDirection: 'row', alignItems: 'flex-end' },
  dayHeading: { flexGrow: 1, flexShrink: 1, paddingRight: mm(6) },
  bodyMap: { flexDirection: 'row', flexShrink: 0 },
  // 1:2 like the outlines' 100x200 viewBox.
  bodyFigure: { width: mm(18), height: mm(36) },
  bodyFigureGap: { width: mm(3) },
  dayKicker: { fontFamily: FONT_LABEL, fontSize: 11, letterSpacing: 2.2 },
  dayTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 42,
    lineHeight: 1.06,
    textTransform: 'uppercase',
    letterSpacing: 0.63,
    color: INK,
    marginTop: mm(1.5),
  },

  section: { marginBottom: mm(6.5) },
  // The workout table always closes the page; a trailing margin here would be counted when
  // react-pdf decides whether the section fits, and would push a whole table onto page two.
  sectionLast: { marginBottom: 0 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: mm(4) },
  sectionMark: { width: mm(2.6), height: mm(2.6), marginRight: mm(3) },
  sectionLabel: {
    fontFamily: FONT_LABEL,
    fontSize: 12,
    letterSpacing: 2.16,
    textTransform: 'uppercase',
    color: INK,
    marginRight: mm(3),
  },
  sectionRule: { flexGrow: 1, height: 1, backgroundColor: LINE },

  /* ---------- Warm-up ---------- */
  warmupGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  warmupItem: { width: '50%', flexDirection: 'row', marginBottom: mm(2.2) },
  warmupItemLeft: { paddingRight: mm(4) },
  warmupItemRight: { paddingLeft: mm(4) },
  warmupBullet: { fontFamily: FONT_LABEL, fontSize: 10, marginRight: mm(2.5) },
  warmupText: { fontSize: 9.5, color: '#222222', lineHeight: 1.4, flexShrink: 1 },
  warmupDo: {
    backgroundColor: PANEL,
    borderLeftWidth: mm(1.2),
    borderLeftStyle: 'solid',
    paddingVertical: mm(3),
    paddingHorizontal: mm(4.5),
    marginTop: mm(1.3),
  },
  warmupDoText: { fontSize: 9, fontWeight: 600, letterSpacing: 0.36, textTransform: 'uppercase' },

  /* ---------- Cardio ---------- */
  cardioBar: { flexDirection: 'row', alignItems: 'stretch', borderWidth: 1, borderColor: LINE },
  cardioTag: {
    backgroundColor: DARK,
    justifyContent: 'center',
    paddingVertical: mm(4),
    paddingHorizontal: mm(6),
  },
  cardioTagText: {
    fontFamily: FONT_LABEL,
    fontSize: 11,
    letterSpacing: 1.98,
    textTransform: 'uppercase',
    color: WHITE,
  },
  cardioStat: {
    flexGrow: 1,
    flexBasis: 0,
    paddingVertical: mm(3.2),
    paddingHorizontal: mm(6),
    borderLeftWidth: 1,
    borderLeftColor: LINE,
    borderLeftStyle: 'solid',
  },
  statLabel: { fontFamily: FONT_LABEL, fontSize: 7.5, letterSpacing: 1.5 },
  statValue: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', marginTop: mm(1) },

  /* ---------- Workout table ---------- */
  tableHead: { flexDirection: 'row', backgroundColor: DARK },
  th: {
    fontFamily: FONT_DISPLAY,
    fontSize: 10.5,
    letterSpacing: 0.95,
    textTransform: 'uppercase',
    color: WHITE,
    textAlign: 'center',
    paddingVertical: mm(3),
    paddingHorizontal: mm(3),
  },
  thFirst: { textAlign: 'left', paddingLeft: mm(4) },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    borderBottomStyle: 'solid',
  },
  td: {
    fontSize: 10,
    fontWeight: 500,
    textAlign: 'center',
    // The template's rows are 3.4mm-padded single lines; ours carry a second, smaller line,
    // so the padding comes in to keep a full session on one page at the same rhythm.
    paddingVertical: mm(2.6),
    paddingHorizontal: mm(3),
  },
  tdEmpty: { color: INK_FAINT, fontWeight: 400 },
  // The template's `small-cell`: a cell holding a cue rather than a number sets smaller and
  // bolder so a sentence in the Speed column never outweighs the figures beside it.
  tdSmall: { fontSize: 7, fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.35, color: '#333333' },
  tdExercise: {
    paddingVertical: mm(2.6),
    paddingRight: mm(3),
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Same picture rule as the web (`MoveThumbnail`): uploaded image, else the cropped body.
  exThumb: {
    width: mm(10),
    height: mm(10),
    marginRight: mm(3),
    borderRadius: mm(1.5),
    backgroundColor: PANEL,
    overflow: 'hidden',
    flexShrink: 0,
  },
  exThumbImage: { width: mm(10), height: mm(10), objectFit: 'cover' },
  exThumbFigure: { width: mm(10), height: mm(10) },
  exBody: { flexGrow: 1, flexShrink: 1 },
  exName: { flexDirection: 'row' },
  exNum: { fontFamily: FONT_LABEL, fontSize: 9, marginRight: mm(3) },
  exText: {
    fontSize: 9.5,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.19,
    flexShrink: 1,
    lineHeight: 1.25,
  },
  exMeta: {
    fontSize: 7,
    fontWeight: 600,
    textTransform: 'uppercase',
    lineHeight: 1.35,
    color: '#333333',
    marginTop: mm(0.7),
  },
  exNote: { fontSize: 7, lineHeight: 1.35, color: INK_SOFT, marginTop: mm(0.8) },

  emptyState: { fontSize: 10, color: INK_SOFT },

  /* ---------- Footer ---------- */
  footer: {
    position: 'absolute',
    bottom: 0,
    left: PAGE_GUTTER,
    right: PAGE_GUTTER,
    height: FOOTER_HEIGHT,
    borderTopWidth: 1,
    borderTopColor: LINE,
    borderTopStyle: 'solid',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7.5,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: INK_FAINT,
    flexShrink: 1,
    paddingRight: mm(4),
  },
  footerPhone: { fontSize: 7.5, letterSpacing: 0.9, color: INK_SOFT, fontWeight: 600 },
})

/** Only a literal hex colour reaches pdfkit — anything else would throw mid-render. */
function safeBrand(value: string | null): string {
  return value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : DEFAULT_BRAND
}

/** `!= null` rather than truthiness — 0 is a real value for every numeric field here. */
function cell(value: string | number | null, unit = ''): { text: string; empty: boolean } {
  if (value == null || value === '') return { text: '—', empty: true }
  return { text: unit ? `${value} ${unit}`.replace(' %', '%') : String(value), empty: false }
}

function movementMeta(row: SharedRow): string {
  const movement = row.movementType.charAt(0).toUpperCase() + row.movementType.slice(1)
  return row.equipment ? `${movement} · ${row.equipment.name}` : movement
}

function cardioStats(session: SharedSession): { label: string; value: string }[] {
  const stats: { label: string; value: string }[] = []
  if (session.cardioMinutes != null) stats.push({ label: 'Time', value: `${session.cardioMinutes} min` })
  if (session.cardioBpm != null) stats.push({ label: 'Heart Rate', value: `${session.cardioBpm} BPM` })
  if (session.cardioIncline != null) stats.push({ label: 'Incline', value: `${session.cardioIncline}%` })
  return stats
}

type PdfImage = { data: Buffer; format: 'png' | 'jpg' }
/** Uploaded move images by URL; a URL that failed to load (or is WebP) is simply absent. */
type PdfImages = Map<string, PdfImage>

function PageHeader({ plan, brand, logo }: { plan: SharedPlan; brand: string; logo: PdfImage | null }) {
  return (
    <View style={[styles.header, { borderBottomColor: brand }]} fixed>
      <View style={styles.coachBlock}>
        {/* react-pdf's <Image> is a PDF primitive, not an <img>: it has no alt prop to take. */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        {logo && <Image src={logo} style={styles.logo} />}
        <View style={styles.coachText}>
          <Text style={styles.coachName}>{plan.coach.name}</Text>
          {plan.coach.title && <Text style={styles.coachTitle}>{plan.coach.title}</Text>}
        </View>
      </View>
      <View style={styles.clientBlock}>
        <Text style={[styles.clientLabel, { color: brand }]}>Client</Text>
        <Text style={styles.clientName}>{plan.client.name}</Text>
      </View>
    </View>
  )
}

function PageFooter({ plan }: { plan: SharedPlan }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        {plan.coach.name} · {plan.plan.title}
      </Text>
      {plan.coach.phone && <Text style={styles.footerPhone}>{plan.coach.phone}</Text>}
    </View>
  )
}

function SectionHead({ label, brand }: { label: string; brand: string }) {
  return (
    <View style={styles.sectionHead}>
      <View style={[styles.sectionMark, { backgroundColor: brand }]} />
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionRule} />
    </View>
  )
}

function WarmUp({ session, brand }: { session: SharedSession; brand: string }) {
  const plain = session.warmupLines.filter((line) => !line.highlighted)
  const highlighted = session.warmupLines.filter((line) => line.highlighted)

  return (
    <View style={styles.section}>
      <SectionHead label="Warm-Up" brand={brand} />
      {plain.length > 0 && (
        <View style={styles.warmupGrid}>
          {plain.map((line, i) => (
            <View
              key={i}
              style={[styles.warmupItem, i % 2 === 0 ? styles.warmupItemLeft : styles.warmupItemRight]}
            >
              <Text style={[styles.warmupBullet, { color: brand }]}>+</Text>
              <Text style={styles.warmupText}>{line.text}</Text>
            </View>
          ))}
        </View>
      )}
      {highlighted.map((line, i) => (
        <View key={i} style={[styles.warmupDo, { borderLeftColor: brand }]}>
          <Text style={styles.warmupDoText}>{line.text}</Text>
        </View>
      ))}
    </View>
  )
}

function CardioBar({ session, brand }: { session: SharedSession; brand: string }) {
  const stats = cardioStats(session)
  if (stats.length === 0) return null

  return (
    <View style={styles.section}>
      <View style={styles.cardioBar}>
        <View style={styles.cardioTag}>
          <Text style={styles.cardioTagText}>Cardio</Text>
        </View>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.cardioStat}>
            <Text style={[styles.statLabel, { color: brand }]}>{stat.label}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function RowThumb({ row, image, brand }: { row: SharedRow; image: PdfImage | undefined; brand: string }) {
  if (image) {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <View style={styles.exThumb}><Image src={image} style={styles.exThumbImage} /></View>
  }
  if (row.muscles.length === 0) return <View style={[styles.exThumb, { backgroundColor: WHITE }]} />
  const shades = shadesForMove(row.muscles)
  const shapes = busiestSide(shades) === 'back' ? BACK_BODY : FRONT_BODY
  return (
    <View style={styles.exThumb}>
      <BodyFigure
        shapes={shapes}
        shades={shades}
        brand={brand}
        viewBox={focusViewBox(shapes, shades)}
        style={styles.exThumbFigure}
      />
    </View>
  )
}

function WorkoutRow({
  row, index, brand, image,
}: {
  row: SharedRow
  index: number
  brand: string
  image: PdfImage | undefined
}) {
  const speed = cell(row.speed)
  const cells = [
    { key: 'sets', ...cell(row.sets), style: COL.sets, small: false },
    { key: 'reps', ...cell(row.reps), style: COL.reps, small: false },
    { key: 'rest', ...cell(row.rest, 'sec'), style: COL.rest, small: false },
    // Speed is free text: `2/1/2` is a figure, "negative control" is a cue.
    { key: 'speed', ...speed, style: COL.speed, small: speed.text.length > 10 },
    { key: 'oneRm', ...cell(row.oneRm, '%'), style: COL.oneRm, small: false },
  ]

  return (
    <View style={styles.tr} wrap={false}>
      <View style={[styles.tdExercise, COL.exercise]}>
        <RowThumb row={row} image={image} brand={brand} />
        <View style={styles.exBody}>
          <View style={styles.exName}>
            <Text style={[styles.exNum, { color: brand }]}>{String(index + 1).padStart(2, '0')}</Text>
            <Text style={styles.exText}>{row.exercise.name}</Text>
          </View>
          <Text style={styles.exMeta}>{movementMeta(row)}</Text>
          {row.note && <Text style={styles.exNote}>{row.note}</Text>}
        </View>
      </View>
      {cells.map((c) => (
        <Text
          key={c.key}
          style={[
            styles.td,
            c.style,
            c.small ? styles.tdSmall : undefined,
            c.empty ? styles.tdEmpty : undefined,
          ]}
        >
          {c.text}
        </Text>
      ))}
    </View>
  )
}

function Workout({
  session, brand, images,
}: {
  session: SharedSession
  brand: string
  images: PdfImages
}) {
  return (
    <View style={[styles.section, styles.sectionLast]}>
      <SectionHead label="Workout" brand={brand} />
      <View style={styles.tableHead}>
        <Text style={[styles.th, styles.thFirst, COL.exercise]}>Exercise</Text>
        <Text style={[styles.th, COL.sets]}>Sets</Text>
        <Text style={[styles.th, COL.reps]}>Reps</Text>
        <Text style={[styles.th, COL.rest]}>Rest</Text>
        <Text style={[styles.th, COL.speed]}>Speed</Text>
        <Text style={[styles.th, COL.oneRm]}>1RM</Text>
      </View>
      {session.rows.map((row, i) => (
        <WorkoutRow
          key={i}
          row={row}
          index={i}
          brand={brand}
          image={row.exercise.imageUrl ? images.get(row.exercise.imageUrl) : undefined}
        />
      ))}
    </View>
  )
}

function BodyFigure({
  shapes, shades, brand, viewBox = BODY_VIEWBOX, style = styles.bodyFigure,
}: {
  shapes: RegionShape[]
  shades: RegionShades
  brand: string
  viewBox?: string
  style?: Style
}) {
  return (
    <Svg viewBox={viewBox} style={style}>
      {shapes.flatMap(({ region, points }) => {
        const shade = shades[region]
        return points.map((p, i) => (
          <Polygon
            key={`${region}-${i}`}
            points={p}
            fill={shade === undefined ? INK : brand}
            // A touch darker than on screen so the unworked body survives printing.
            fillOpacity={shade === undefined ? 0.2 : shadeOpacity(shade)}
          />
        ))
      })}
    </Svg>
  )
}

function SessionPage({
  plan, session, brand, logo, images,
}: {
  plan: SharedPlan
  session: SharedSession
  brand: string
  logo: PdfImage | null
  images: PdfImages
}) {
  const shades = shadesForRows(session.rows.map((row) => ({ muscles: row.muscles, sets: row.sets })))
  const hasMuscles = Object.keys(shades).length > 0

  return (
    <Page size="A4" style={styles.page}>
      <PageHeader plan={plan} brand={brand} logo={logo} />
      <View style={styles.dayBanner}>
        <View style={styles.dayHeading}>
          {session.weekday && (
            <Text style={[styles.dayKicker, { color: brand }]}>{session.weekday}</Text>
          )}
          <Text style={styles.dayTitle}>{session.label}</Text>
        </View>
        {hasMuscles && (
          <View style={styles.bodyMap}>
            <BodyFigure shapes={FRONT_BODY} shades={shades} brand={brand} />
            <View style={styles.bodyFigureGap} />
            <BodyFigure shapes={BACK_BODY} shades={shades} brand={brand} />
          </View>
        )}
      </View>
      {session.warmupLines.length > 0 && <WarmUp session={session} brand={brand} />}
      <CardioBar session={session} brand={brand} />
      {session.rows.length > 0 && <Workout session={session} brand={brand} images={images} />}
      <PageFooter plan={plan} />
    </Page>
  )
}

export function PlanPdfDocument({
  plan, logo, images,
}: {
  plan: SharedPlan
  logo: PdfImage | null
  images: PdfImages
}) {
  const brand = safeBrand(plan.coach.brandColor)

  return (
    <Document title={`${plan.client.name} — ${plan.plan.title}`} author={plan.coach.name}>
      {plan.sessions.length > 0 ? (
        plan.sessions.map((session, i) => (
          <SessionPage key={i} plan={plan} session={session} brand={brand} logo={logo} images={images} />
        ))
      ) : (
        <Page size="A4" style={styles.page}>
          <PageHeader plan={plan} brand={brand} logo={logo} />
          <Text style={styles.emptyState}>
            No sessions have been added to this plan yet.
          </Text>
          <PageFooter plan={plan} />
        </Page>
      )}
    </Document>
  )
}

/** `<Client_Name>_Workout_Plan.pdf` — runs of anything non-alphanumeric collapse to one `_`. */
function planPdfFilename(plan: SharedPlan): string {
  const slug = plan.client.name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return `${slug || 'Client'}_Workout_Plan.pdf`
}

/**
 * react-pdf only decodes PNG and JPEG, and a single unreachable or exotic logo would otherwise
 * fail the whole render. Fetching it here lets a bad logo degrade to "no logo" instead of a 500.
 * The timeout keeps a slow/hanging logo host from stalling the render until the platform limit —
 * the abort it raises lands in the same catch as any other fetch failure.
 */
async function loadImage(url: string | null): Promise<PdfImage | null> {
  if (!url) return null
  try {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    if (!response.ok) return null
    const data = Buffer.from(await response.arrayBuffer())
    if (data.length > 4 && data[0] === 0x89 && data[1] === 0x50) return { data, format: 'png' }
    if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8) return { data, format: 'jpg' }
    return null
  } catch {
    return null
  }
}

/** The one entry point both download routes share: payload in, PDF bytes + filename out. */
export async function renderPlanPdf(
  plan: SharedPlan,
): Promise<{ body: Uint8Array<ArrayBuffer>; filename: string }> {
  const imageUrls = [
    ...new Set(plan.sessions.flatMap((s) => s.rows.flatMap((r) => r.exercise.imageUrl ?? []))),
  ]
  const [logo, ...loaded] = await Promise.all([
    loadImage(plan.coach.logoUrl),
    ...imageUrls.map((url) => loadImage(url)),
  ])
  const images: PdfImages = new Map()
  imageUrls.forEach((url, i) => {
    const image = loaded[i]
    if (image) images.set(url, image)
  })
  const buffer = await renderToBuffer(<PlanPdfDocument plan={plan} logo={logo ?? null} images={images} />)
  // Copied into a plain ArrayBuffer-backed view: a Node Buffer can sit on a SharedArrayBuffer,
  // which `BodyInit` does not accept.
  const body = new Uint8Array(buffer.byteLength)
  body.set(buffer)
  return { body, filename: planPdfFilename(plan) }
}
