import { ImageResponse } from 'next/og'
import { STORY, STORY_CARDS, storyFonts } from '@/components/story/story-cards'
import { loadLogo, safeBrand } from '@/lib/coach-brand'
import { isStoryDesign, storyDateLabel } from '@/lib/story'
import { getSharedPlan } from '@/services/share'

// Public and unauthenticated, like the share page. Rendering is slow (seconds on a cold start), so
// the card is cached for a day by the browser and Vercel's CDN; the share page puts a `v` of the
// plan's and coach's last save in the URL, so an edit asks for a fresh card instead.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** `/p/<slug>/story/<design>/<day index>?date=YYYY-MM-DD&v=…` → a 1080×1920 story card PNG. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; design: string; day: string }> },
) {
  const { slug, design, day } = await params
  if (!isStoryDesign(design) || !/^\d{1,3}$/.test(day)) return new Response('Not found', { status: 404 })
  const plan = await getSharedPlan(slug)
  const session = plan?.sessions[Number(day)]
  if (!plan || !session) return new Response('Not found', { status: 404 })

  const logo = await loadLogo(plan.coach.logoUrl)
  const date = storyDateLabel(new URL(request.url).searchParams.get('date'))
  return new ImageResponse(
    STORY_CARDS[design]({ plan, session, brand: safeBrand(plan.coach.brandColor), logo, date }),
    { ...STORY, fonts: await storyFonts, headers: { 'cache-control': 'public, max-age=86400, s-maxage=86400' } },
  )
}
