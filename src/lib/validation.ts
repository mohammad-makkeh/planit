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

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  imageUrl: optionalTrimmed.pipe(z.string().url('Enter a valid URL').optional()),
  tutorialUrl: optionalTrimmed.pipe(z.string().url('Enter a valid URL').optional()),
  tagIds: z.array(z.string().uuid()).default([]),
})
export type ExerciseInput = z.infer<typeof exerciseSchema>

export const tagSchema = z.object({
  name: z.string().trim().min(1, 'Tag name is required'),
})
export type TagInput = z.infer<typeof tagSchema>

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
    status: z.enum(['draft', 'active', 'completed']),
  })
  .partial()
export type PlanMetaInput = z.infer<typeof planMetaSchema>

const patchText = (max: number) => z.string().max(max).nullable()

export const planPatchSchema = z.object({
  plan: z.object({ title: z.string().trim().min(1).max(200) }).partial().optional(),
  sessions: z
    .record(
      z.string().uuid(),
      z
        .object({
          label: z.string().trim().min(1).max(120),
          weekday: z.string().max(20).nullable(),
          focusNote: patchText(500),
          warmupLines: z
            .array(z.object({ text: z.string().min(1).max(300), highlighted: z.boolean() }))
            .max(50),
          cardioTime: patchText(120),
          cardioHrm: patchText(120),
        })
        .partial(),
    )
    .optional(),
  rows: z
    .record(
      z.string().uuid(),
      z
        .object({
          sets: patchText(40),
          reps: patchText(40),
          speed: patchText(120),
          oneRm: patchText(120),
          rest: patchText(60),
          note: patchText(500),
        })
        .partial(),
    )
    .optional(),
})
export type PlanPatch = z.infer<typeof planPatchSchema>
