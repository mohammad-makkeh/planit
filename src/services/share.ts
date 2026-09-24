import 'server-only'
import type { MuscleWork } from '@/lib/muscle-map'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  clients, coaches, equipment, exerciseEquipment, exerciseMuscleTargets, exercises, muscleTargets,
  planRows, planSessions, plans,
} from '@/db/schema'

export type SharedRow = {
  exercise: { name: string; tutorialUrl: string | null }
  movementType: 'push' | 'pull' | 'static'
  /** Muscle targets in catalog display order. */
  muscles: MuscleWork[]
  equipment: { name: string; imageUrl: string | null } | null
  sets: number | null
  reps: number | null
  speed: string | null
  oneRm: number | null
  rest: number | null
  note: string | null
}

export type SharedSession = {
  label: string
  weekday: string | null
  warmupLines: { text: string }[]
  cardioMinutes: number | null
  cardioBpm: number | null
  cardioIncline: number | null
  rows: SharedRow[]
}

export type SharedPlan = {
  coach: {
    name: string; title: string | null; phone: string | null; logoUrl: string | null; brandColor: string | null
    /** Last profile save — a new logo or colour has to reach the cached story cards. */
    updatedAt: Date
  }
  client: { name: string }
  plan: { title: string; updatedAt: Date }
  sessions: SharedSession[]
}

type PlanRow = typeof plans.$inferSelect

/** Shared by getSharedPlan and getPlanForPrint once the plan row has been resolved and ownership-checked. */
async function buildSharedPlan(planRow: PlanRow | undefined): Promise<SharedPlan | null> {
  if (!planRow) return null

  const coach = await db.query.coaches.findFirst({
    where: eq(coaches.id, planRow.coachId),
    columns: { name: true, title: true, phone: true, logoUrl: true, brandColor: true, updatedAt: true },
  })
  if (!coach) return null

  const client = await db.query.clients.findFirst({
    where: and(
      eq(clients.id, planRow.clientId),
      eq(clients.coachId, planRow.coachId),
      isNull(clients.deletedAt),
    ),
    columns: { name: true },
  })
  if (!client) return null

  const sessions = await db.query.planSessions.findMany({
    where: eq(planSessions.planId, planRow.id),
    orderBy: [asc(planSessions.position)],
  })

  const rowRecords =
    sessions.length > 0
      ? await db
          .select({
            sessionId: planRows.sessionId,
            position: planRows.position,
            sets: planRows.sets,
            reps: planRows.reps,
            speed: planRows.speed,
            oneRm: planRows.oneRm,
            rest: planRows.rest,
            note: planRows.note,
            rowEquipmentId: planRows.equipmentId,
            exerciseId: exercises.id,
            exerciseName: exercises.name,
            exerciseTutorialUrl: exercises.tutorialUrl,
            movementType: exercises.movementType,
            defaultEquipmentId: exercises.defaultEquipmentId,
          })
          .from(planRows)
          .innerJoin(exercises, eq(planRows.exerciseId, exercises.id))
          .where(inArray(planRows.sessionId, sessions.map((s) => s.id)))
          .orderBy(asc(planRows.position))
      : []

  const exerciseIds = [...new Set(rowRecords.map((r) => r.exerciseId))]
  const equipmentLinks =
    exerciseIds.length > 0
      ? await db
          .select({
            exerciseId: exerciseEquipment.exerciseId,
            id: equipment.id,
            name: equipment.name,
            imageUrl: equipment.imageUrl,
          })
          .from(exerciseEquipment)
          .innerJoin(equipment, eq(exerciseEquipment.equipmentId, equipment.id))
          .where(inArray(exerciseEquipment.exerciseId, exerciseIds))
      : []

  const equipmentByExercise = new Map<string, { id: string; name: string; imageUrl: string | null }[]>()
  for (const link of equipmentLinks) {
    const list = equipmentByExercise.get(link.exerciseId) ?? []
    list.push({ id: link.id, name: link.name, imageUrl: link.imageUrl })
    equipmentByExercise.set(link.exerciseId, list)
  }

  const muscleLinks =
    exerciseIds.length > 0
      ? await db
          .select({
            exerciseId: exerciseMuscleTargets.exerciseId,
            name: muscleTargets.name,
            primary: exerciseMuscleTargets.isPrimary,
          })
          .from(exerciseMuscleTargets)
          .innerJoin(muscleTargets, eq(exerciseMuscleTargets.muscleTargetId, muscleTargets.id))
          .where(inArray(exerciseMuscleTargets.exerciseId, exerciseIds))
          .orderBy(asc(muscleTargets.position), asc(muscleTargets.name))
      : []

  const musclesByExercise = new Map<string, MuscleWork[]>()
  for (const link of muscleLinks) {
    const list = musclesByExercise.get(link.exerciseId) ?? []
    list.push({ name: link.name, primary: link.primary })
    musclesByExercise.set(link.exerciseId, list)
  }

  const rowsBySession = new Map<string, SharedRow[]>()
  for (const r of rowRecords) {
    const linkedEquipment = equipmentByExercise.get(r.exerciseId) ?? []
    const resolvedEquipment =
      linkedEquipment.find((e) => e.id === r.rowEquipmentId) ??
      linkedEquipment.find((e) => e.id === r.defaultEquipmentId) ??
      null

    const list = rowsBySession.get(r.sessionId) ?? []
    list.push({
      exercise: {
        name: r.exerciseName,
        tutorialUrl: r.exerciseTutorialUrl,
      },
      movementType: r.movementType,
      muscles: musclesByExercise.get(r.exerciseId) ?? [],
      equipment: resolvedEquipment ? { name: resolvedEquipment.name, imageUrl: resolvedEquipment.imageUrl } : null,
      sets: r.sets,
      reps: r.reps,
      speed: r.speed,
      oneRm: r.oneRm,
      rest: r.rest,
      note: r.note,
    })
    rowsBySession.set(r.sessionId, list)
  }

  return {
    coach: {
      name: coach.name,
      title: coach.title,
      phone: coach.phone,
      logoUrl: coach.logoUrl,
      brandColor: coach.brandColor,
      updatedAt: coach.updatedAt,
    },
    client: { name: client.name },
    plan: { title: planRow.title, updatedAt: planRow.updatedAt },
    sessions: sessions.map((s) => ({
      label: s.label,
      weekday: s.weekday,
      warmupLines: s.warmupLines,
      cardioMinutes: s.cardioMinutes,
      cardioBpm: s.cardioBpm,
      cardioIncline: s.cardioIncline,
      rows: rowsBySession.get(s.id) ?? [],
    })),
  }
}

/** Public — no session. Never leak ids, coach email, plan status, or the slug itself. */
export async function getSharedPlan(slug: string): Promise<SharedPlan | null> {
  if (!/^[\w-]{8,32}$/.test(slug)) return null
  const planRow = await db.query.plans.findFirst({
    where: and(eq(plans.shareSlug, slug), isNull(plans.deletedAt)),
  })
  return buildSharedPlan(planRow)
}

/** Coach-owned print payload — same public-safe shape, scoped by session-authenticated coachId. */
export async function getPlanForPrint(coachId: string, planId: string): Promise<SharedPlan | null> {
  const planRow = await db.query.plans.findFirst({
    where: and(eq(plans.id, planId), eq(plans.coachId, coachId), isNull(plans.deletedAt)),
  })
  return buildSharedPlan(planRow)
}
