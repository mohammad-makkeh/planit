import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from './client'
import { coaches, exerciseTags, exercises, tags, warmupPresets } from './schema'
import { SEED_EXERCISES, SEED_WARMUPS, TAG_NAMES } from './seed-data'

type SeedCoach = { email: string; password: string; name: string }

function coachFromEnv(n: 1 | 2): SeedCoach {
  const email = process.env[`SEED_COACH${n}_EMAIL`]
  const password = process.env[`SEED_COACH${n}_PASSWORD`]
  const name = process.env[`SEED_COACH${n}_NAME`]
  if (!email || !password || !name) throw new Error(`Missing SEED_COACH${n}_* env vars`)
  return { email: email.toLowerCase(), password, name }
}

async function seedCoach(input: SeedCoach): Promise<void> {
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
    .insert(tags)
    .values(TAG_NAMES.map((name) => ({ coachId, name })))
    .onConflictDoNothing()
  const tagRows = await db.query.tags.findMany({ where: eq(tags.coachId, coachId) })
  const tagIdByName = new Map(tagRows.map((t) => [t.name, t.id]))

  await db
    .insert(exercises)
    .values(SEED_EXERCISES.map((e) => ({ coachId, name: e.name })))
    .onConflictDoNothing()
  const exerciseRows = await db.query.exercises.findMany({
    where: eq(exercises.coachId, coachId),
  })
  const exerciseIdByName = new Map(exerciseRows.map((e) => [e.name, e.id]))

  const links = SEED_EXERCISES.flatMap((e) => {
    const exerciseId = exerciseIdByName.get(e.name)
    if (!exerciseId) return []
    return e.tags.flatMap((t) => {
      const tagId = tagIdByName.get(t)
      return tagId ? [{ exerciseId, tagId }] : []
    })
  })
  if (links.length > 0) await db.insert(exerciseTags).values(links).onConflictDoNothing()

  const existing = await db.query.warmupPresets.findMany({
    where: eq(warmupPresets.coachId, coachId),
  })
  const existingTexts = new Set(existing.map((w) => w.text))
  const missing = SEED_WARMUPS.filter((t) => !existingTexts.has(t)).map((text) => ({
    coachId,
    text,
  }))
  if (missing.length > 0) await db.insert(warmupPresets).values(missing)

  console.log(`Seeded ${input.email}: ${exerciseRows.length} exercises, ${tagRows.length} tags`)
}

async function main(): Promise<void> {
  await seedCoach(coachFromEnv(1))
  await seedCoach(coachFromEnv(2))
  console.log('Seed complete')
  process.exit(0)
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
