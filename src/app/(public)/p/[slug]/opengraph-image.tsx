import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { loadLogo, safeBrand } from '@/lib/coach-brand'
import { BACK_BODY, BODY_VIEWBOX, FRONT_BODY, shadeOpacity, shadesForRows, type RegionShades, type RegionShape } from '@/lib/muscle-map'
import { getSharedPlan } from '@/services/share'

/**
 * The link preview for a share link (WhatsApp, iMessage, …): the share page header's dark band
 * and brand-coloured rule, the coach's logo and name, the plan title and the week's body figure.
 * Rendered per request like the page itself, so a renamed plan or a new logo shows up the next
 * time the link is pasted.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const alt = 'Workout plan'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const DARK = '#0F0F0F'

// The PDF's Inter files, traced into this route by `outputFileTracingIncludes` in next.config.ts.
const FONT_DIR = join(process.cwd(), 'src/pdf-fonts')
const fonts = Promise.all(
  ([500, 700, 800] as const).map(async (weight) => ({
    name: 'Inter',
    data: await readFile(join(FONT_DIR, `Inter-${weight}.ttf`)),
    weight,
    style: 'normal' as const,
  })),
)

function Figure({ shapes, shades, brand }: { shapes: RegionShape[]; shades: RegionShades; brand: string }) {
  return (
    <svg viewBox={BODY_VIEWBOX} width={228} height={456}>
      {shapes.map(({ region, points }) => {
        const shade = shades[region]
        return points.map((p, i) => (
          <polygon
            key={`${region}-${i}`}
            points={p}
            fill={shade === undefined ? '#FFFFFF' : brand}
            fillOpacity={shade === undefined ? 0.14 : shadeOpacity(shade)}
          />
        ))
      })}
    </svg>
  )
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const plan = await getSharedPlan(slug)
  if (!plan) return new Response('Not found', { status: 404 })

  const brand = safeBrand(plan.coach.brandColor)
  const logo = await loadLogo(plan.coach.logoUrl)
  const shades = shadesForRows(plan.sessions.flatMap((s) => s.rows))
  const days = plan.sessions.length
  const moves = plan.sessions.reduce((sum, s) => sum + s.rows.length, 0)
  const facts = [
    days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : null,
    moves > 0 ? `${moves} ${moves === 1 ? 'move' : 'moves'}` : null,
  ].filter(Boolean)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: DARK,
          borderBottom: `14px solid ${brand}`,
          fontFamily: 'Inter',
          color: '#FFFFFF',
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '64px 32px 56px 72px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            {logo && (
              <img
                alt=""
                src={`data:image/${logo.format === 'jpg' ? 'jpeg' : 'png'};base64,${logo.data.toString('base64')}`}
                style={{ height: 64, maxWidth: 420, objectFit: 'contain', marginBottom: 20 }}
              />
            )}
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 0.5 }}>{plan.coach.name}</div>
            {plan.coach.title && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 18,
                  fontWeight: 500,
                  letterSpacing: 2.2,
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.6)',
                }}
              >
                {plan.coach.title}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 5,
                textTransform: 'uppercase',
                color: brand,
              }}
            >
              Workout plan
            </div>
            {/* Satori only clamps block boxes. Long titles step down a size before they clamp. */}
            <div
              style={{
                display: 'block',
                marginTop: 14,
                fontSize: plan.plan.title.length > 24 ? 56 : 68,
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: -1.5,
                lineClamp: 2,
              }}
            >
              {plan.plan.title}
            </div>
            <div
              style={{
                display: 'block',
                marginTop: 20,
                fontSize: 28,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.7)',
                lineClamp: 1,
              }}
            >
              {[`For ${plan.client.name}`, ...facts].join('  ·  ')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingRight: 72 }}>
          <Figure shapes={FRONT_BODY} shades={shades} brand={brand} />
          <Figure shapes={BACK_BODY} shades={shades} brand={brand} />
        </div>
      </div>
    ),
    { ...size, fonts: await fonts },
  )
}
