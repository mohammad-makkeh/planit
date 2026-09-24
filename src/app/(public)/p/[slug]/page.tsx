import { cache } from 'react'
import type { Metadata } from 'next'
import { LinkInactive } from '@/components/share/link-inactive'
import { ShareView } from '@/components/share/share-view'
import { getSharedPlan } from '@/services/share'

// Public, unauthenticated view — always fetch fresh, never prerender or cache.
export const dynamic = 'force-dynamic'

// generateMetadata and the page both need the plan; one query per request serves both.
const getPlan = cache(getSharedPlan)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const plan = await getPlan(slug)
  const robots = { index: false, follow: false }
  if (!plan) return { title: 'Workout Plan', robots }

  // What the link preview in WhatsApp shows: "Ali — 5-Day Split", from the coach. The preview
  // image comes from `opengraph-image.tsx` next to this page. A title that already names the
  // client ("Ali's cut") is left alone rather than reading "Ali — Ali's cut".
  const firstName = plan.client.name.trim().split(/\s+/)[0] ?? ''
  const named = !firstName || plan.plan.title.toLowerCase().includes(firstName.toLowerCase())
  const title = named ? plan.plan.title : `${firstName} — ${plan.plan.title}`
  const description = plan.coach.title ? `${plan.coach.name} · ${plan.coach.title}` : plan.coach.name
  return {
    title,
    description,
    robots,
    openGraph: { type: 'website', title, description, siteName: plan.coach.name },
  }
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  // getSharedPlan validates the slug shape (`^[\w-]{8,32}$`) before querying — a malformed
  // slug never touches the database, it just resolves to null like any other dead link.
  const plan = await getPlan(slug)

  if (!plan) return <LinkInactive />

  return <ShareView plan={plan} slug={slug} />
}
