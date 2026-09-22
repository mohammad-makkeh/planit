import { renderPlanPdf } from '@/components/pdf/plan-pdf'
import { getSharedPlan } from '@/services/share'

// Public and unauthenticated — always rendered fresh from the current plan, never cached.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  // getSharedPlan validates the slug shape (`^[\w-]{8,32}$`) before querying — a malformed
  // slug never touches the database, it just resolves to null like any other dead link.
  const plan = await getSharedPlan(slug)
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
