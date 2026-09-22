import { notFound } from 'next/navigation'
import { z } from 'zod'
import { PrintView } from '@/components/share/print-view'
import { requireCoachId } from '@/lib/session'
import { getPlanForPrint } from '@/services/share'

export default async function CoachPrintPage({
  params,
}: {
  params: Promise<{ planId: string }>
}) {
  const coachId = await requireCoachId()
  const { planId } = await params
  if (!z.string().uuid().safeParse(planId).success) notFound()

  const plan = await getPlanForPrint(coachId, planId)
  if (!plan) notFound()

  return <PrintView plan={plan} brand={plan.coach.brandColor ?? '#FE2E00'} />
}
