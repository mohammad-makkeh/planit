import 'server-only'
import { and, asc, count, countDistinct, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  equipment, exerciseEquipment, exerciseMuscleTargets, exercises, muscleTargets, planRows,
  planSessions, plans,
} from '@/db/schema'
import type { ExerciseInput } from '@/lib/validation'

export type Exercise = typeof exercises.$inferSelect
export type ExerciseWithDetails = Exercise & {
  muscleTargets: { id: string; name: string; primary: boolean }[]
  equipment: { id: string; name: string; imageUrl: string | null }[]
}
export type ExerciseUsage = { rowCount: number; planCount: number }

export async function listExercises(coachId: string): Promise<ExerciseWithDetails[]> {
  const rows = await db
    .select()
    .from(exercises)
    .where(eq(exercises.coachId, coachId))
    .orderBy(asc(exercises.name))
  if (rows.length === 0) return []
  const exerciseIds = rows.map((r) => r.id)

  const muscleLinks = await db
    .select({
      exerciseId: exerciseMuscleTargets.exerciseId,
      id: muscleTargets.id,
      name: muscleTargets.name,
      primary: exerciseMuscleTargets.isPrimary,
    })
    .from(exerciseMuscleTargets)
    .innerJoin(muscleTargets, eq(exerciseMuscleTargets.muscleTargetId, muscleTargets.id))
    .where(inArray(exerciseMuscleTargets.exerciseId, exerciseIds))
    .orderBy(asc(muscleTargets.position), asc(muscleTargets.name))

  const musclesByExercise = new Map<string, { id: string; name: string; primary: boolean }[]>()
  for (const link of muscleLinks) {
    const list = musclesByExercise.get(link.exerciseId) ?? []
    list.push({ id: link.id, name: link.name, primary: link.primary })
    musclesByExercise.set(link.exerciseId, list)
  }

  const equipmentLinks = await db
    .select({
      exerciseId: exerciseEquipment.exerciseId,
      id: equipment.id,
      name: equipment.name,
      imageUrl: equipment.imageUrl,
    })
    .from(exerciseEquipment)
    .innerJoin(equipment, eq(exerciseEquipment.equipmentId, equipment.id))
    .where(inArray(exerciseEquipment.exerciseId, exerciseIds))
    .orderBy(asc(equipment.name))

  const equipmentByExercise = new Map<string, { id: string; name: string; imageUrl: string | null }[]>()
  for (const link of equipmentLinks) {
    const list = equipmentByExercise.get(link.exerciseId) ?? []
    list.push({ id: link.id, name: link.name, imageUrl: link.imageUrl })
    equipmentByExercise.set(link.exerciseId, list)
  }

  return rows.map((r) => ({
    ...r,
    muscleTargets: musclesByExercise.get(r.id) ?? [],
    equipment: equipmentByExercise.get(r.id) ?? [],
  }))
}

function toRow(input: ExerciseInput, defaultEquipmentId: string) {
  return {
    name: input.name,
    imageUrl: input.imageUrl ?? null,
    tutorialUrl: input.tutorialUrl ?? null,
    movementType: input.movementType,
    defaultEquipmentId,
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Keeps only ids that exist in a catalog, in the order the coach picked them — the lookup
 * returns rows in an arbitrary order, so the input drives the order. For equipment the first
 * entry becomes the exercise's default, which keeps "the default is always a linked
 * equipment" true.
 */
function inPickedOrder(pickedIds: string[], existing: { id: string }[]): string[] {
  const known = new Set(existing.map((e) => e.id))
  return pickedIds.filter((id) => known.has(id))
}

async function resolveCatalogIds(tx: Tx, input: ExerciseInput) {
  const equipmentIds = inPickedOrder(
    input.equipmentIds,
    await tx.select({ id: equipment.id }).from(equipment).where(inArray(equipment.id, input.equipmentIds)),
  )
  const pickedMuscleIds = input.muscleTargets.map((m) => m.id)
  const knownMuscleIds = pickedMuscleIds.length > 0
    ? inPickedOrder(
        pickedMuscleIds,
        await tx
          .select({ id: muscleTargets.id })
          .from(muscleTargets)
          .where(inArray(muscleTargets.id, pickedMuscleIds)),
      )
    : []
  const primaryById = new Map(input.muscleTargets.map((m) => [m.id, m.primary]))
  const muscles = knownMuscleIds.map((id) => ({ id, primary: primaryById.get(id) ?? true }))
  const defaultEquipmentId = equipmentIds[0]
  if (!defaultEquipmentId) throw new Error('No known equipment picked')
  return { equipmentIds, muscles, defaultEquipmentId }
}

async function linkCatalogs(
  tx: Tx,
  exerciseId: string,
  { equipmentIds, muscles }: { equipmentIds: string[]; muscles: { id: string; primary: boolean }[] },
) {
  if (equipmentIds.length > 0) {
    await tx
      .insert(exerciseEquipment)
      .values(equipmentIds.map((equipmentId) => ({ exerciseId, equipmentId })))
      .onConflictDoNothing()
  }
  if (muscles.length > 0) {
    await tx
      .insert(exerciseMuscleTargets)
      .values(muscles.map((m) => ({ exerciseId, muscleTargetId: m.id, isPrimary: m.primary })))
      .onConflictDoNothing()
  }
}

export async function createExercise(coachId: string, input: ExerciseInput): Promise<Exercise> {
  return db.transaction(async (tx) => {
    const resolved = await resolveCatalogIds(tx, input)
    const [created] = await tx
      .insert(exercises)
      .values({ coachId, ...toRow(input, resolved.defaultEquipmentId) })
      .returning()
    if (!created) throw new Error('Insert returned no row')
    await linkCatalogs(tx, created.id, resolved)
    return created
  })
}

export async function updateExercise(
  coachId: string,
  exerciseId: string,
  input: ExerciseInput,
): Promise<Exercise | undefined> {
  return db.transaction(async (tx) => {
    const resolved = await resolveCatalogIds(tx, input)
    const [updated] = await tx
      .update(exercises)
      .set(toRow(input, resolved.defaultEquipmentId))
      .where(and(eq(exercises.id, exerciseId), eq(exercises.coachId, coachId)))
      .returning()
    if (!updated) return undefined
    await tx.delete(exerciseEquipment).where(eq(exerciseEquipment.exerciseId, exerciseId))
    await tx.delete(exerciseMuscleTargets).where(eq(exerciseMuscleTargets.exerciseId, exerciseId))
    await linkCatalogs(tx, exerciseId, resolved)
    return updated
  })
}

export async function getExerciseUsage(coachId: string, exerciseId: string): Promise<ExerciseUsage> {
  const [usage] = await db
    .select({ rowCount: count(planRows.id), planCount: countDistinct(plans.id) })
    .from(planRows)
    .innerJoin(planSessions, eq(planRows.sessionId, planSessions.id))
    .innerJoin(plans, eq(planSessions.planId, plans.id))
    .where(and(eq(planRows.exerciseId, exerciseId), eq(plans.coachId, coachId), isNull(plans.deletedAt)))
  return usage ?? { rowCount: 0, planCount: 0 }
}

/** HARD delete — FK cascade removes catalog links AND plan_rows (spec sync rule). */
export async function deleteExercise(coachId: string, exerciseId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(exercises)
    .where(and(eq(exercises.id, exerciseId), eq(exercises.coachId, coachId)))
    .returning({ id: exercises.id })
  return deleted !== undefined
}
