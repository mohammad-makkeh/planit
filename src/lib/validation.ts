import { z } from 'zod'

/** '' or null → undefined, else Number — for optional numeric form fields */
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().positive().optional(),
)

const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .optional()

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const clientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  phone: optionalTrimmed,
  age: optionalNumber,
  weightKg: optionalNumber,
  heightCm: optionalNumber,
  notes: optionalTrimmed,
})
export type ClientInput = z.infer<typeof clientSchema>

export const movementTypes = ['push', 'pull', 'static'] as const
export type MovementType = (typeof movementTypes)[number]

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  imageUrl: optionalTrimmed.pipe(z.string().url('Enter a valid URL').optional()),
  tutorialUrl: optionalTrimmed.pipe(
    z.url({ protocol: /^https?$/, error: 'Enter a valid URL' }).optional(),
  ),
  muscleTargets: z
    .array(z.object({ id: z.string().uuid(), primary: z.boolean() }))
    .max(30)
    .default([]),
  movementType: z.enum(movementTypes),
  equipmentIds: z.array(z.string().uuid()).min(1, 'Pick at least one equipment').max(20),
})
export type ExerciseInput = z.infer<typeof exerciseSchema>

export const warmupSchema = z.object({
  text: z.string().trim().min(1, 'Warm-up text is required'),
})
export type WarmupInput = z.infer<typeof warmupSchema>

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  title: optionalTrimmed,
  phone: optionalTrimmed,
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  brandColor: optionalTrimmed.pipe(
    z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #FE2E00').optional(),
  ),
  logoUrl: optionalTrimmed.pipe(z.string().url().optional()),
})
export type ProfileInput = z.infer<typeof profileSchema>

export const planMetaSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    status: z.enum(['draft', 'active']),
  })
  .partial()
export type PlanMetaInput = z.infer<typeof planMetaSchema>

const docText = (max: number) => z.string().max(max).nullable()
const docInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable()

export const planDocumentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  sessions: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        weekday: z.string().max(20).nullable(),
        warmupLines: z
          .array(z.object({ text: z.string().min(1).max(300), highlighted: z.boolean() }))
          .max(50),
        cardioMinutes: docInt(1, 999),
        cardioBpm: docInt(1, 250),
        cardioIncline: docInt(0, 15),
        rows: z
          .array(
            z.object({
              exerciseId: z.string().uuid(),
              equipmentId: z.string().uuid().nullable().optional(),
              sets: docInt(1, 99),
              reps: docInt(1, 999),
              speed: docText(120),
              oneRm: docInt(1, 100),
              rest: docInt(0, 3600),
              note: docText(500),
            }),
          )
          .max(100),
      }),
    )
    .max(30),
})
export type PlanDocument = z.infer<typeof planDocumentSchema>
