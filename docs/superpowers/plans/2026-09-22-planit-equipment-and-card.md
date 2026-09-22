# Equipment, Movement Type & Client Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Equipment as a CRUD library entity (with icons used as move-thumbnail fallbacks), a required movement-type field on moves, per-row equipment choice in the editor, and the approved client-card redesign.

**Architecture:** One additive SQL migration (new `equipment` + junction, two new `exercises` columns, one new `plan_rows` column, per-coach seeded equipment, tag→enum backfill). Services/actions/validation follow the repo's existing coach-scoped patterns; UI reuses BottomSheet/TagMultiSelect/TagFilter patterns.

**Tech Stack:** unchanged (Next.js App Router, strict TS, Drizzle + generated SQL migrations, Base UI shadcn, vaul BottomSheet).

**Spec:** docs/superpowers/specs/2026-09-22-planit-equipment-and-card-design.md

## Global Constraints

- Strict TypeScript; NO automated tests (explicit decision). Gates per task: `npm run typecheck && npm run lint && npm run build` — zero errors (2 pre-existing `react-hooks/incompatible-library` warnings acceptable).
- **NEVER run `npm run db:migrate`, `db:push`, or `db:seed`** — the database is live production data; the controller runs the migration at capstone. Creating/editing migration files is fine (they don't touch the DB until migrate runs).
- Multi-tenancy: every service takes `coachId` first and scopes every query by it.
- Base UI shadcn: `render` prop not `asChild`; menu items use `onClick`, never `onSelect`. Form modals use the vaul BottomSheet family from `@/components/ui/bottom-sheet`.
- ActionResult pattern via `tryAction`; zod at the action boundary; UUID guards on client-supplied ids.
- Row semantics: `plan_rows.equipment_id NULL` = inherit the move's default. Display always resolves `row.equipment ?? move default`.
- Commit trailer, own line in the body after a blank line, exactly: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Never push. Never dispatch subagents. One commit per task.

---

### Task 1: Schema, migration, icons, seed data

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0001_*.sql` (via `npm run db:generate`, then replace its content — see Step 2)
- Create: `public/equipment/{any,barbell,dumbbell,kettlebell,cable,machine,bodyweight,band,ez-bar,smith-machine}.svg`
- Modify: `src/db/seed-data.ts`, `src/db/seed.ts`

**Interfaces (produces):** `equipment`, `exerciseEquipment` tables; `movementTypeEnum`; `exercises.movementType`, `exercises.defaultEquipmentId`; `planRows.equipmentId`.

- [ ] **Step 1: schema.ts.** Add after `planStatusEnum`:

```ts
export const movementTypeEnum = pgEnum('movement_type', ['push', 'pull', 'static'])
```

Add after the `coaches` table (equipment must be declared before `exercises` references it):

```ts
export const equipment = pgTable('equipment', {
  id,
  coachId: uuid('coach_id').notNull().references(() => coaches.id),
  name: text('name').notNull(),
  imageUrl: text('image_url'),
  isFallback: boolean('is_fallback').notNull().default(false),
  createdAt,
}, (t) => [uniqueIndex('equipment_coach_name_uq').on(t.coachId, sql`lower(${t.name})`)])
```

(add `boolean` to the drizzle-orm/pg-core import). Extend `exercises` with:

```ts
  movementType: movementTypeEnum('movement_type').notNull().default('static'),
  defaultEquipmentId: uuid('default_equipment_id').notNull().references(() => equipment.id),
```

Add after `exerciseTags`:

```ts
export const exerciseEquipment = pgTable('exercise_equipment', {
  exerciseId: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  equipmentId: uuid('equipment_id').notNull().references(() => equipment.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.exerciseId, t.equipmentId] })])
```

Extend `planRows` with:

```ts
  equipmentId: uuid('equipment_id').references(() => equipment.id, { onDelete: 'set null' }),
```

- [ ] **Step 2: migration.** Run `npm run db:generate` (this updates the drizzle meta snapshot and journal and creates `drizzle/0001_<name>.sql`). Then REPLACE that file's entire content with exactly:

```sql
CREATE TYPE "public"."movement_type" AS ENUM('push', 'pull', 'static');--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"is_fallback" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "exercise_equipment" (
	"exercise_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	CONSTRAINT "exercise_equipment_exercise_id_equipment_id_pk" PRIMARY KEY("exercise_id","equipment_id")
);--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_equipment" ADD CONSTRAINT "exercise_equipment_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_coach_name_uq" ON "equipment" USING btree ("coach_id", lower("name"));--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "movement_type" "movement_type" DEFAULT 'static' NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "default_equipment_id" uuid;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_default_equipment_id_equipment_id_fk" FOREIGN KEY ("default_equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_rows" ADD COLUMN "equipment_id" uuid;--> statement-breakpoint
ALTER TABLE "plan_rows" ADD CONSTRAINT "plan_rows_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "equipment" ("coach_id","name","image_url","is_fallback")
SELECT c.id, e.name, e.icon, e.is_fallback FROM "coaches" c
CROSS JOIN (VALUES
	('Any','/equipment/any.svg', true),
	('Barbell','/equipment/barbell.svg', false),
	('Dumbbell','/equipment/dumbbell.svg', false),
	('Kettlebell','/equipment/kettlebell.svg', false),
	('Cable','/equipment/cable.svg', false),
	('Machine','/equipment/machine.svg', false),
	('Bodyweight','/equipment/bodyweight.svg', false),
	('Resistance band','/equipment/band.svg', false),
	('EZ bar','/equipment/ez-bar.svg', false),
	('Smith machine','/equipment/smith-machine.svg', false)
) AS e(name, icon, is_fallback);--> statement-breakpoint
UPDATE "exercises" ex SET "movement_type"='pull'
WHERE EXISTS (SELECT 1 FROM "exercise_tags" et JOIN "tags" t ON t.id = et.tag_id
	WHERE et.exercise_id = ex.id AND lower(t.name) = 'pull');--> statement-breakpoint
UPDATE "exercises" ex SET "movement_type"='push'
WHERE EXISTS (SELECT 1 FROM "exercise_tags" et JOIN "tags" t ON t.id = et.tag_id
	WHERE et.exercise_id = ex.id AND lower(t.name) = 'push');--> statement-breakpoint
DELETE FROM "tags" WHERE lower("name") IN ('push','pull');--> statement-breakpoint
UPDATE "exercises" ex SET "default_equipment_id" = eq.id
FROM "equipment" eq WHERE eq."coach_id" = ex."coach_id" AND eq."is_fallback";--> statement-breakpoint
INSERT INTO "exercise_equipment" ("exercise_id","equipment_id")
SELECT ex.id, ex."default_equipment_id" FROM "exercises" ex;--> statement-breakpoint
ALTER TABLE "exercises" ALTER COLUMN "default_equipment_id" SET NOT NULL;
```

DO NOT run db:migrate.

- [ ] **Step 3: icons.** Create the 10 SVGs verbatim. Shared opening tag for every file:
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#404040" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">` … `</svg>` — bodies:

`any.svg`: `<circle cx="12" cy="12" r="9"/><path d="M12 7.5v9M8.1 9.75l7.8 4.5M15.9 9.75l-7.8 4.5"/>`
`barbell.svg`: `<path d="M2.5 12h19"/><rect x="4" y="7" width="2" height="10" rx="1"/><rect x="7" y="9" width="2" height="6" rx="1"/><rect x="15" y="9" width="2" height="6" rx="1"/><rect x="18" y="7" width="2" height="10" rx="1"/>`
`dumbbell.svg`: `<path d="M9.5 12h5"/><rect x="4.5" y="8" width="2" height="8" rx="1"/><rect x="7.5" y="9.5" width="2" height="5" rx="1"/><rect x="14.5" y="9.5" width="2" height="5" rx="1"/><rect x="17.5" y="8" width="2" height="8" rx="1"/>`
`kettlebell.svg`: `<circle cx="12" cy="14.5" r="5"/><path d="M8.8 10.9C8 6.5 10 4.5 12 4.5s4 2 3.2 6.4"/>`
`cable.svg`: `<circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V14M12 14l-4 3M12 14l4 3M8 17h8"/>`
`machine.svg`: `<rect x="7" y="6" width="10" height="3" rx="1"/><rect x="7" y="10.5" width="10" height="3" rx="1"/><rect x="7" y="15" width="10" height="3" rx="1"/><path d="M12 3.5V6"/>`
`bodyweight.svg`: `<circle cx="12" cy="5.5" r="2.25"/><path d="M12 8v6M12 9.5l-4.5 3M12 9.5l4.5 3M12 14l-3.5 5.5M12 14l3.5 5.5"/>`
`band.svg`: `<path d="M3.5 16c2.5 0 2.5-8 5.5-8s3 8 6 8 3-8 5.5-8"/>`
`ez-bar.svg`: `<path d="M2.5 12H6l3-2.5 3 2.5 3-2.5 3 2.5h3.5"/><path d="M5.5 9v6M18.5 9v6"/>`
`smith-machine.svg`: `<path d="M5 20V4h14v16M5 13h14M7 10.5V13M17 10.5V13"/>`

- [ ] **Step 4: seed script.** In `src/db/seed-data.ts`: export an `EQUIPMENT` array of the 10 `{ name, imageUrl, isFallback }` entries above; remove `push`/`pull` from the tag list and from every exercise's tags, and give each exercise a `movementType` ('push' | 'pull' | 'static') derived from the tag it used to carry (neither → 'static'). In `src/db/seed.ts`: insert equipment per coach, and set every seeded exercise's `defaultEquipmentId` to that coach's Any + insert the matching `exerciseEquipment` row (mirror how tags are linked). Keep idempotency conventions the file already uses.

- [ ] **Step 5: Gates** (`npm run typecheck && npm run lint && npm run build`). Note: NOT db:migrate/db:seed.

- [ ] **Step 6: Commit** — `feat: equipment/movement-type schema, migration, icons, seeds` + trailer.

---

### Task 2: Validation + equipment service + actions

**Files:**
- Modify: `src/lib/validation.ts`
- Create: `src/services/equipment.ts`
- Create: `src/actions/equipment.ts`

**Interfaces (produces):** `equipmentSchema`/`EquipmentInput`, `movementTypes`; `listEquipment/createEquipment/updateEquipment/deleteEquipment`, types `Equipment`, `EquipmentWithUsage`; actions `createEquipmentAction/updateEquipmentAction/deleteEquipmentAction`.

- [ ] **Step 1: validation.ts.** Add (near tagSchema):

```ts
export const movementTypes = ['push', 'pull', 'static'] as const
export type MovementType = (typeof movementTypes)[number]

export const equipmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  imageUrl: optionalTrimmed.pipe(z.string().url('Enter a valid URL').optional()),
})
export type EquipmentInput = z.infer<typeof equipmentSchema>
```

- [ ] **Step 2: service.** `src/services/equipment.ts`:

```ts
import 'server-only'
import { and, asc, count, eq, ne } from 'drizzle-orm'
import { db } from '@/db/client'
import { equipment, exerciseEquipment, exercises } from '@/db/schema'
import type { EquipmentInput } from '@/lib/validation'

export type Equipment = typeof equipment.$inferSelect
export type EquipmentWithUsage = Equipment & { moveCount: number }

export async function listEquipment(coachId: string): Promise<EquipmentWithUsage[]> {
  const rows = await db
    .select({
      id: equipment.id,
      coachId: equipment.coachId,
      name: equipment.name,
      imageUrl: equipment.imageUrl,
      isFallback: equipment.isFallback,
      createdAt: equipment.createdAt,
      moveCount: count(exerciseEquipment.exerciseId),
    })
    .from(equipment)
    .leftJoin(exerciseEquipment, eq(exerciseEquipment.equipmentId, equipment.id))
    .where(eq(equipment.coachId, coachId))
    .groupBy(equipment.id)
    .orderBy(asc(equipment.name))
  return rows
}

export async function createEquipment(coachId: string, input: EquipmentInput): Promise<Equipment> {
  const [created] = await db
    .insert(equipment)
    .values({ coachId, name: input.name, imageUrl: input.imageUrl ?? null })
    .returning()
  if (!created) throw new Error('Insert returned no row')
  return created
}

export async function updateEquipment(
  coachId: string,
  equipmentId: string,
  input: EquipmentInput,
): Promise<Equipment | undefined> {
  const [updated] = await db
    .update(equipment)
    .set({ name: input.name, imageUrl: input.imageUrl ?? null })
    .where(and(eq(equipment.id, equipmentId), eq(equipment.coachId, coachId)))
    .returning()
  return updated
}

export type DeleteEquipmentResult = 'deleted' | 'not_found' | 'fallback'

/**
 * Aggressive sync (spec): moves defaulting to it get their first other linked
 * equipment, else the coach's fallback ("Any", also re-linked); junction rows
 * cascade; plan rows revert to NULL (inherit) via FK. "Any" is undeletable.
 */
export async function deleteEquipment(coachId: string, equipmentId: string): Promise<DeleteEquipmentResult> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(equipment)
      .where(and(eq(equipment.id, equipmentId), eq(equipment.coachId, coachId)))
    if (!target) return 'not_found'
    if (target.isFallback) return 'fallback'

    const affected = await tx
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(eq(exercises.coachId, coachId), eq(exercises.defaultEquipmentId, equipmentId)))

    if (affected.length > 0) {
      const [fallback] = await tx
        .select({ id: equipment.id })
        .from(equipment)
        .where(and(eq(equipment.coachId, coachId), eq(equipment.isFallback, true)))
      if (!fallback) throw new Error('Coach has no fallback equipment')
      for (const move of affected) {
        const [other] = await tx
          .select({ equipmentId: exerciseEquipment.equipmentId })
          .from(exerciseEquipment)
          .where(and(
            eq(exerciseEquipment.exerciseId, move.id),
            ne(exerciseEquipment.equipmentId, equipmentId),
          ))
          .limit(1)
        const newDefault = other?.equipmentId ?? fallback.id
        if (!other) {
          await tx
            .insert(exerciseEquipment)
            .values({ exerciseId: move.id, equipmentId: fallback.id })
            .onConflictDoNothing()
        }
        await tx.update(exercises).set({ defaultEquipmentId: newDefault }).where(eq(exercises.id, move.id))
      }
    }

    await tx.delete(equipment).where(eq(equipment.id, equipmentId))
    return 'deleted'
  })
}
```

- [ ] **Step 3: actions.** `src/actions/equipment.ts` mirroring `src/actions/exercises.ts` exactly (read it first): tryAction wrapper, uuid guards, zod parse with fieldErrors, revalidatePath of `/library`, unique-violation → the same conflict mapping the exercises actions use. `deleteEquipmentAction` maps service results: `not_found` → the standard not-found error; `fallback` → validation-style error with message `"Any" is the fallback and can't be deleted.`; `deleted` → ok(null).

- [ ] **Step 4: Gates.** — [ ] **Step 5: Commit** — `feat: equipment service, actions, validation` + trailer.

---

### Task 3: Exercises + plans services carry equipment & movement type

**Files:**
- Modify: `src/services/exercises.ts`, `src/actions/exercises.ts` (only if its zod/type plumbing needs it — actions already pass `ExerciseInput` through), `src/lib/validation.ts`, `src/services/plans.ts`

**Interfaces (produces):** `ExerciseWithTags` gains `equipment: {id,name,imageUrl:string|null}[]` (plus `movementType`/`defaultEquipmentId` via $inferSelect); `exerciseSchema` requires `movementType`, `equipmentIds` (min 1), `defaultEquipmentId ∈ equipmentIds`; `planDocumentSchema` rows accept optional nullable `equipmentId`; `EditorRow.equipmentId: string | null`; `savePlanDocument` persists + ownership-checks it.

- [ ] **Step 1: validation.** Replace `exerciseSchema` with:

```ts
export const exerciseSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    imageUrl: optionalTrimmed.pipe(z.string().url('Enter a valid URL').optional()),
    tutorialUrl: optionalTrimmed.pipe(z.string().url('Enter a valid URL').optional()),
    tagIds: z.array(z.string().uuid()).default([]),
    movementType: z.enum(movementTypes),
    equipmentIds: z.array(z.string().uuid()).min(1, 'Pick at least one equipment').max(20),
    defaultEquipmentId: z.string().uuid(),
  })
  .refine((v) => v.equipmentIds.includes(v.defaultEquipmentId), {
    message: 'Default must be one of the selected equipment',
    path: ['defaultEquipmentId'],
  })
```

In `planDocumentSchema` rows, add `equipmentId: z.string().uuid().nullable().optional(),` after `exerciseId` (optional so the editor keeps compiling until Task 6 wires it — the doc-level staging is intentional; Task 6 completes it).

- [ ] **Step 2: exercises service.** `listExercises`: add a second links query joining `exerciseEquipment`+`equipment` (mirror the tags one, selecting id/name/imageUrl) and attach `equipment` arrays; extend `ExerciseWithTags` accordingly. `toRow` gains `movementType: input.movementType, defaultEquipmentId: input.defaultEquipmentId`. `createExercise`/`updateExercise`: verify ownership of `input.equipmentIds` (coach-scoped select, mirror the tags ownership pattern) and REQUIRE that the owned set still contains `defaultEquipmentId` (else `throw new Error('Default equipment not owned')`); replace the junction rows (delete-then-insert on update, insert on create) with the owned ids.

- [ ] **Step 3: plans service.** `EditorRow` gains `equipmentId: string | null`; `getPlanForEditor` selects `planRows.equipmentId`; `savePlanDocument`: collect distinct non-null `row.equipmentId`s across the doc and ownership-check them exactly like the exercise-ids check beside it (failure → same `undefined`/not-found path); insert `equipmentId: row.equipmentId ?? null` on each row.

- [ ] **Step 3b: staging patch so gates stay green.** `src/components/library/exercise-form-sheet.tsx` still compiles against the old schema; extend ONLY its `reset({...})` object with:

```ts
        movementType: exercise?.movementType ?? 'static',
        equipmentIds: exercise?.equipment.map((e) => e.id) ?? [],
        defaultEquipmentId: exercise?.defaultEquipmentId ?? '',
```

This keeps typecheck green; creating a move is runtime-blocked by friendly zod errors until Task 5 adds the real inputs (intentional mid-branch staging — the app is not deployed from this branch).

- [ ] **Step 4: Gates** (note: the editor still compiles because the doc field is optional; existing saves send no equipmentId and rows keep their DB value only until the next full save — accepted mid-branch staging, closed by Task 6).

- [ ] **Step 5: Commit** — `feat: moves carry movement type and equipment; rows carry equipment` + trailer.

---

### Task 4: Library — Equipment tab

**Files:**
- Create: `src/components/library/equipment-tab.tsx`, `src/components/library/equipment-form-sheet.tsx`, `src/components/library/equipment-delete-dialog.tsx`
- Modify: `src/app/(app)/library/page.tsx` (fetch `listEquipment`, third tab "Equipment")

Recipes (read the referenced files first — mirror them):
- `equipment-form-sheet.tsx`: mirror `exercise-form-sheet.tsx` (BottomSheet shell, react-hook-form + zodResolver on `equipmentSchema`, wasOpen reset guard, `ImageUploadField` with folder `"equipment"` + URL input) for create & edit; title "New equipment"/"Edit equipment".
- `equipment-tab.tsx`: mirror the list style of `warmups-tab.tsx` but with rows showing a 40px icon (`imageUrl` img, else the generic `Dumbbell` placeholder used by exercise cards), name, muted `Used by N move(s)`, pencil (opens the form sheet) and trash (opens delete dialog — HIDDEN for the `isFallback` row); an "Add equipment" button opens the create sheet.
- `equipment-delete-dialog.tsx`: mirror `exercise-delete-dialog.tsx`; body copy: `Used by {moveCount} move(s). They'll fall back to another of their equipment (or "Any").`; calls `deleteEquipmentAction`, toasts the result.
- `library/page.tsx`: also await `listEquipment(coachId)`, add the third `TabsTrigger`/`TabsContent`.

- [ ] Gates; Commit — `feat: equipment tab in library` + trailer.

---

### Task 5: Move form — movement type, equipment multi-select, default

**Files:**
- Create: `src/components/library/equipment-multi-select.tsx`
- Modify: `src/components/library/exercise-form-sheet.tsx`, `src/components/library/library-moves-tab.tsx`, `src/app/(app)/library/page.tsx`, `src/app/(app)/clients/[id]/plans/[planId]/page.tsx`, `src/components/plan-editor/plan-editor.tsx`, `src/components/plan-editor/exercise-picker-sheet.tsx` (prop threading ONLY in these last three)

Recipes:
- `equipment-multi-select.tsx`: mirror `tag-multi-select.tsx` (chip toggles + inline create by name via `createEquipmentAction`, `onCreated` bubbling) with `EquipmentOption = { id, name, imageUrl: string | null, isFallback: boolean }`; chips show a 16px icon when `imageUrl` present.
- `exercise-form-sheet.tsx` gains props `equipmentOptions: EquipmentOption[]`: movement-type single-select chip row (three chips Push/Pull/Static, TagFilter chip styling, sets `movementType`); the multi-select bound to `equipmentIds`; a "Default equipment" `Select` (from `@/components/ui/select`) whose options are only the currently selected equipment — when `equipmentIds.length === 1` force `defaultEquipmentId` to it. Reset defaults: `movementType: exercise?.movementType ?? 'static'`, `equipmentIds: exercise?.equipment.map((e) => e.id) ?? [fallbackId]`, `defaultEquipmentId: exercise?.defaultEquipmentId ?? fallbackId` where `fallbackId = equipmentOptions.find((o) => o.isFallback)!.id`. `onCreated` payload unchanged.
- Thread `equipmentOptions` from the library page → `library-moves-tab` → both form-sheet usages, and from the editor page RSC (`listEquipment`) → `plan-editor` → `exercise-picker-sheet` → its form-sheet usage (picker/editor make NO other use of it yet — Task 6 does).

- [ ] Gates; Commit — `feat: move form captures type, equipment, default` + trailer.

---

### Task 6: Editor — picker variant choice, row equipment chip, fallback thumbs, document plumbing

**Files:**
- Modify: `src/components/plan-editor/plan-editor.tsx`, `exercise-picker-sheet.tsx`, `exercise-rows.tsx`, `exercise-row-card.tsx`, `session-panel.tsx` (prop threading as needed)
- Create: `src/components/plan-editor/row-equipment-sheet.tsx`

Requirements (local-first — every interaction is pure local state; the explicit Save persists):
1. `plan-editor.tsx`: local row objects and `toDocument()` include `equipmentId: row.equipmentId ?? null`; `addRow(sessionId, exercise, equipmentId: string | null)`; new `setRowEquipment(sessionId, rowId, equipmentId: string | null)` via `mutate`. `PickedExercise` unchanged.
2. Picker: `onPick(exercise, equipmentId: string | null)`. Tapping a move whose `equipment.length > 1` expands (local state, one at a time) an inline chip row under it listing that move's equipment (16px icon + name, TagFilter chip styling); tapping a chip picks with that EXPLICIT id (even if it's the default). A move with exactly one equipment picks directly with `null` (inherit). Thumbnails in the list use the fallback chain: move image → default-equipment icon → Dumbbell placeholder.
3. Row card: same thumbnail fallback chain (row-resolved equipment). An equipment chip (14px icon + name, muted outline) near the exercise name shows the resolved equipment (`row.equipmentId` ?? move default — resolve via the `exercises` list already passed to the editor, looked up by the row's exercise id; a row whose exercise is missing from the list shows no chip). Tapping the chip opens `row-equipment-sheet.tsx`: a small BottomSheet titled "Equipment — <move name>" listing the move's equipment (icon + name; the move's default row is annotated "· default"); selecting the default stores `null`, any other stores its id; current selection shows a Check. Pure local via `setRowEquipment`.
4. Zero-latency guarantee unchanged: no server calls from any of this; `savePlanDocumentAction` payload now carries `equipmentId` per row.

- [ ] Gates; Commit — `feat: per-row equipment choice in editor with icon fallbacks` + trailer.

---

### Task 7: Library moves tab — type filter, type chip, fallback thumbs

**Files:**
- Modify: `src/components/library/library-moves-tab.tsx`, `src/components/library/exercise-card.tsx`

Requirements:
- A movement-type filter row (chips: All / Push / Pull / Static, TagFilter chip styling, single-select local state) rendered ABOVE the existing tag chips; both filters AND-compose in the `filtered` memo.
- `exercise-card.tsx`: thumbnail fallback chain (move image → default-equipment icon → Dumbbell); a small muted outline chip with the capitalized movement type rendered beside the tag chips.

- [ ] Gates; Commit — `feat: movement-type filter and equipment-icon fallbacks in library` + trailer.

---

### Task 8: Client card redesign (approved variant B)

**Files:**
- Modify: `src/components/clients/client-card.tsx`

Replace the component body with exactly (imports: drop `Badge`, add `ChevronRight` from lucide-react; keep `Blobatar`, `formatRelative`):

```tsx
export function ClientCard({ client }: { client: ClientListItem }) {
  return (
    <Link
      href={`/clients/${client.id}`}
      className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/40 active:bg-accent/60"
    >
      <div className="shrink-0">
        <Blobatar name={client.name} size={44} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{client.name}</p>
        <p className="truncate text-sm text-muted-foreground">{client.phone ?? 'No phone'}</p>
        <p className="truncate text-xs text-muted-foreground">
          {client.planCount} {client.planCount === 1 ? 'plan' : 'plans'} · updated{' '}
          {formatRelative(client.lastActivityAt)}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}
```

- [ ] Gates; Commit — `feat: client card meta line and chevron` + trailer.

---

## Post-plan (controller)

1. Run `npm run db:migrate` against the live DB; verify with SQL: equipment count = 10 per coach; every exercise has non-null default + a junction row; zero tags named push/pull; movement-type distribution matches the former tags.
2. Browser capstone at 390 (mobile emulation) + 1280: equipment tab CRUD incl. delete-with-reassignment and undeletable Any; move create/edit with type/equipment/default (incl. forced-default-when-single); both filter rows; icon fallback thumbs in library, picker, editor rows; picker variant pick → row chip reflects it; row chip switch → Save → hard reload persists; client card; editor zero-latency regression (no POSTs during edits). Screenshots at both widths to the user.
3. Final whole-branch review (fable), one fix wave max, finishing menu.
