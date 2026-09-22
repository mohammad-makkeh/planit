import { z } from 'zod'
import { renderPlanPdf } from '@/components/pdf/plan-pdf'
import { requireCoachId } from '@/lib/session'
import { getPlanForPrint } from '@/services/share'

// Reads the session cookie and renders with Node APIs (fs for the fonts) — never cached,
// never prerendered.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const coachId = await requireCoachId()
  const { planId } = await params
  if (!z.string().uuid().safeParse(planId).success) {
    return new Response('Not found', { status: 404 })
  }

  const plan = await getPlanForPrint(coachId, planId)
  if (!plan) return new Response('Not found', { status: 404 })

  const { body, filename } = await renderPlanPdf(plan)
  return new Response(body, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}
