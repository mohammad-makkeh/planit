import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from './client'
import {
  coaches, equipment, exerciseEquipment, exerciseMuscleTargets, exercises, muscleTargets,
  warmupPresets,
} from './schema'
import { EQUIPMENT, SEED_EXERCISES, SEED_WARMUPS } from './seed-data'

type SeedCoach = { email: string; password: string; name: string }

function coachFromEnv(n: 1 | 2): SeedCoach {
  const email = process.env[`SEED_COACH${n}_EMAIL`]
  const password = process.env[`SEED_COACH${n}_PASSWORD`]
  const name = process.env[`SEED_COACH${n}_NAME`]
  if (!email || !password || !name) throw new Error(`Missing SEED_COACH${n}_* env vars`)
  return { email: email.toLowerCase(), password, name }
}

type Catalogs = { anyEquipmentId: string; muscleIdByName: Map<string, string> }

/** Equipment and muscle targets are global; muscle targets arrive with migration 0003. */
async function seedCatalogs(): Promise<Catalogs> {
  await db
    .insert(equipment)
    .values(EQUIPMENT.map((e) => ({ name: e.name, imageUrl: e.imageUrl, isFallback: e.isFallback })))
    .onConflictDoNothing()
  const anyEquipment = await db.query.equipment.findFirst({ where: eq(equipment.isFallback, true) })
  if (!anyEquipment) throw new Error('Missing fallback ("Any") equipment')
  const muscleRows = await db.select().from(muscleTargets)
  if (muscleRows.length === 0) throw new Error('No muscle targets — run the migrations first')
  return {
    anyEquipmentId: anyEquipment.id,
    muscleIdByName: new Map(muscleRows.map((m) => [m.name, m.id])),
  }
}

async function seedCoach(input: SeedCoach, { anyEquipmentId, muscleIdByName }: Catalogs): Promise<void> {
  let coach = await db.query.coaches.findFirst({ where: eq(coaches.email, input.email) })
  if (!coach) {
    const [created] = await db
      .insert(coaches)
      .values({
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
        name: input.name,
      })
      .returning()
    coach = created
  }
  if (!coach) throw new Error(`Could not create coach ${input.email}`)
  const coachId = coach.id

  await db
    .insert(exercises)
    .values(SEED_EXERCISES.map((e) => ({
      coachId, name: e.name, movementType: e.movementType, defaultEquipmentId: anyEquipmentId,
    })))
    .onConflictDoNothing()
  const exerciseRows = await db.query.exercises.findMany({
    where: eq(exercises.coachId, coachId),
  })
  const exerciseIdByName = new Map(exerciseRows.map((e) => [e.name, e.id]))

  const links = SEED_EXERCISES.flatMap((e) => {
    const exerciseId = exerciseIdByName.get(e.name)
    if (!exerciseId) return []
    return e.muscles.flatMap((name) => {
      const muscleTargetId = muscleIdByName.get(name)
      return muscleTargetId ? [{ exerciseId, muscleTargetId }] : []
    })
  })
  if (links.length > 0) await db.insert(exerciseMuscleTargets).values(links).onConflictDoNothing()

  const equipmentLinks = SEED_EXERCISES.flatMap((e) => {
    const exerciseId = exerciseIdByName.get(e.name)
    return exerciseId ? [{ exerciseId, equipmentId: anyEquipmentId }] : []
  })
  if (equipmentLinks.length > 0) {
    await db.insert(exerciseEquipment).values(equipmentLinks).onConflictDoNothing()
  }

  const existing = await db.query.warmupPresets.findMany({
    where: eq(warmupPresets.coachId, coachId),
  })
  const existingTexts = new Set(existing.map((w) => w.text))
  const missing = SEED_WARMUPS.filter((t) => !existingTexts.has(t)).map((text) => ({
    coachId,
    text,
  }))
  if (missing.length > 0) await db.insert(warmupPresets).values(missing)

  console.log(`Seeded ${input.email}: ${exerciseRows.length} exercises`)
}

async function main(): Promise<void> {
  const catalogs = await seedCatalogs()
  await seedCoach(coachFromEnv(1), catalogs)
  await seedCoach(coachFromEnv(2), catalogs)
  console.log('Seed complete')
  process.exit(0)
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
