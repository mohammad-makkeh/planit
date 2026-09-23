import { notFound } from 'next/navigation'
import { z } from 'zod'
import { PlanEditor } from '@/components/plan-editor/plan-editor'
import { requireCoachId } from '@/lib/session'
import { listEquipment } from '@/services/equipment'
import { listExercises } from '@/services/exercises'
import { listMuscleTargets } from '@/services/muscle-targets'
import { getPlanForEditor } from '@/services/plans'
import { listWarmups } from '@/services/warmups'

export default async function PlanEditorPage({
  params,
}: {
  params: Promise<{ id: string; planId: string }>
}) {
  const coachId = await requireCoachId()
  const { planId } = await params
  if (!z.string().uuid().safeParse(planId).success) notFound()

  const [plan, exercises, muscleTargets, warmups, equipmentOptions] = await Promise.all([
    getPlanForEditor(coachId, planId),
    listExercises(coachId),
    listMuscleTargets(),
    listWarmups(coachId),
    listEquipment(),
  ])
  if (!plan) notFound()

  return (
    <PlanEditor
      initial={plan}
      exercises={exercises}
      muscleTargets={muscleTargets}
      warmups={warmups}
      equipmentOptions={equipmentOptions}
    />
  )
}
