import { notFound } from 'next/navigation'
import { z } from 'zod'
import { PlanEditor } from '@/components/plan-editor/plan-editor'
import { requireCoachId } from '@/lib/session'
import { listExercises } from '@/services/exercises'
import { getPlanForEditor } from '@/services/plans'
import { listTags } from '@/services/tags'
import { listWarmups } from '@/services/warmups'

export default async function PlanEditorPage({
  params,
}: {
  params: Promise<{ id: string; planId: string }>
}) {
  const coachId = await requireCoachId()
  const { planId } = await params
  if (!z.string().uuid().safeParse(planId).success) notFound()

  const [plan, exercises, tags, warmups] = await Promise.all([
    getPlanForEditor(coachId, planId),
    listExercises(coachId),
    listTags(coachId),
    listWarmups(coachId),
  ])
  if (!plan) notFound()

  return (
    <PlanEditor
      initial={plan}
      exercises={exercises}
      tags={tags}
      warmups={warmups}
    />
  )
}
