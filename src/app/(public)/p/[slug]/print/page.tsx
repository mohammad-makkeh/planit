import type { Metadata } from 'next'
import { LinkInactive } from '@/components/share/link-inactive'
import { PrintView } from '@/components/share/print-view'
import { getSharedPlan } from '@/services/share'

// Public, unauthenticated view — always fetch fresh, never prerender or cache.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Workout Plan — Print',
    robots: { index: false, follow: false },
  }
}

export default async function SharePrintPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  // getSharedPlan validates the slug shape (`^[\w-]{8,32}$`) before querying — a malformed
  // slug never touches the database, it just resolves to null like any other dead link.
  const plan = await getSharedPlan(slug)

  if (!plan) return <LinkInactive />

  return <PrintView plan={plan} brand={plan.coach.brandColor || '#FE2E00'} />
}
