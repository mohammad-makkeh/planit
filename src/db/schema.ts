import { sql } from 'drizzle-orm'
import {
  pgTable, pgEnum, uuid, text, integer, doublePrecision, boolean,
  timestamp, jsonb, primaryKey, uniqueIndex,
} from 'drizzle-orm/pg-core'

export type WarmupLine = { text: string; highlighted: boolean }

export const planStatusEnum = pgEnum('plan_status', ['draft', 'active'])
export const movementTypeEnum = pgEnum('movement_type', ['push', 'pull', 'static'])

const id = uuid('id').primaryKey().defaultRandom()
const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow().notNull().$onUpdate(() => new Date())

export const coaches = pgTable('coaches', {
  id,
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  title: text('title'),
  phone: text('phone'),
  logoUrl: text('logo_url'),
  brandColor: text('brand_color'),
  createdAt,
  updatedAt,
})

/** Global catalog shared by every coach — managed in the database only, never from the app. */
export const equipment = pgTable('equipment', {
  id,
  name: text('name').notNull(),
  imageUrl: text('image_url'),
  isFallback: boolean('is_fallback').notNull().default(false),
  createdAt,
}, (t) => [uniqueIndex('equipment_name_uq').on(sql`lower(${t.name})`)])

/**
 * Global catalog shared by every coach — managed in the database only, never from the app.
 * `position` is the display order (anatomical, not alphabetical).
 */
export const muscleTargets = pgTable('muscle_targets', {
  id,
  name: text('name').notNull(),
  imageUrl: text('image_url'),
  position: integer('position').notNull().default(0),
}, (t) => [uniqueIndex('muscle_targets_name_uq').on(sql`lower(${t.name})`)])

export const clients = pgTable('clients', {
  id,
  coachId: uuid('coach_id').notNull().references(() => coaches.id),
  name: text('name').notNull(),
  phone: text('phone'),
  age: integer('age'),
  weightKg: doublePrecision('weight_kg'),
  heightCm: doublePrecision('height_cm'),
  notes: text('notes'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt,
  updatedAt,
})

export const exercises = pgTable('exercises', {
  id,
  coachId: uuid('coach_id').notNull().references(() => coaches.id),
  name: text('name').notNull(),
  imageUrl: text('image_url'),
  tutorialUrl: text('tutorial_url'),
  movementType: movementTypeEnum('movement_type').notNull().default('static'),
  defaultEquipmentId: uuid('default_equipment_id').notNull().references(() => equipment.id),
  createdAt,
  updatedAt,
}, (t) => [uniqueIndex('exercises_coach_name_uq').on(t.coachId, sql`lower(${t.name})`)])

export const exerciseMuscleTargets = pgTable('exercise_muscle_targets', {
  exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  muscleTargetId: uuid('muscle_target_id').notNull()
    .references(() => muscleTargets.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.exerciseId, t.muscleTargetId] })])

export const exerciseEquipment = pgTable('exercise_equipment', {
  exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  equipmentId: uuid('equipment_id').notNull().references(() => equipment.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.exerciseId, t.equipmentId] })])

export const warmupPresets = pgTable('warmup_presets', {
  id,
  coachId: uuid('coach_id').notNull().references(() => coaches.id),
  text: text('text').notNull(),
  createdAt,
})

export const plans = pgTable('plans', {
  id,
  coachId: uuid('coach_id').notNull().references(() => coaches.id),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  title: text('title').notNull(),
  status: planStatusEnum('status').notNull().default('draft'),
  shareSlug: text('share_slug').unique(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt,
  updatedAt,
})

export const planSessions = pgTable('plan_sessions', {
  id,
  planId: uuid('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  label: text('label').notNull(),
  weekday: text('weekday'),
  warmupLines: jsonb('warmup_lines').$type<WarmupLine[]>().notNull().default(sql`'[]'::jsonb`),
  cardioMinutes: integer('cardio_minutes'),
  cardioBpm: integer('cardio_bpm'),
  cardioIncline: integer('cardio_incline'),
})

export const planRows = pgTable('plan_rows', {
  id,
  sessionId: uuid('session_id').notNull().references(() => planSessions.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  sets: integer('sets'),
  reps: integer('reps'),
  speed: text('speed'),
  oneRm: integer('one_rm'),
  rest: integer('rest'),
  note: text('note'),
  equipmentId: uuid('equipment_id').references(() => equipment.id, { onDelete: 'set null' }),
})
