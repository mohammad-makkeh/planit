import { sql } from 'drizzle-orm'
import {
  pgTable, pgEnum, uuid, text, integer, doublePrecision,
  timestamp, jsonb, primaryKey, uniqueIndex,
} from 'drizzle-orm/pg-core'

export type WarmupLine = { text: string; highlighted: boolean }

export const planStatusEnum = pgEnum('plan_status', ['draft', 'active', 'completed'])

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
  createdAt,
  updatedAt,
}, (t) => [uniqueIndex('exercises_coach_name_uq').on(t.coachId, sql`lower(${t.name})`)])

export const tags = pgTable('tags', {
  id,
  coachId: uuid('coach_id').notNull().references(() => coaches.id),
  name: text('name').notNull(),
}, (t) => [uniqueIndex('tags_coach_name_uq').on(t.coachId, sql`lower(${t.name})`)])

export const exerciseTags = pgTable('exercise_tags', {
  exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.exerciseId, t.tagId] })])

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
  focusNote: text('focus_note'),
  warmupLines: jsonb('warmup_lines').$type<WarmupLine[]>().notNull().default(sql`'[]'::jsonb`),
  cardioTime: text('cardio_time'),
  cardioHrm: text('cardio_hrm'),
})

export const planRows = pgTable('plan_rows', {
  id,
  sessionId: uuid('session_id').notNull().references(() => planSessions.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  sets: text('sets'),
  reps: text('reps'),
  speed: text('speed'),
  oneRm: text('one_rm'),
  rest: text('rest'),
  note: text('note'),
})
