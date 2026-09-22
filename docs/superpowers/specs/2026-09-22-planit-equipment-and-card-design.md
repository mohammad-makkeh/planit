# Planit — Equipment, Movement Type & Client-Card Polish

**Date:** 2026-09-22
**Status:** Approved (user Q&A 2026-09-22; "do it in one go")
**Parent spec:** `2026-09-20-planit-design.md` (Global Constraints and multi-tenancy bind)

## Motivation (user)

Moves need structured metadata beyond free-form tags: a **movement type**
(push vs pull) and **equipment** ("a bicep curl can be done in many machines
or many equipment"). Equipment is a library entity the coach CRUDs, each move
carries one or more with a required default, and when the coach adds a move
to a plan they choose which equipment that row uses. Each equipment has an
**icon** — one look tells the client what to grab, and the icon serves as the
move's thumbnail wherever the move has no image. Tags remain for muscles and
anything else. Separately: the client card's plans-chip + timestamp stack
looks unaligned and gets a subtle redesign (approved variant: meta line under
the phone + right chevron).

## User decisions (locked)

- Entity name: **Equipment**. Neutral fallback equipment named **"Any"**.
- Movement type: required 3-value enum **push | pull | static**; existing
  `push`/`pull` tags are migrated into it and then deleted (tags keep serving
  muscles). A move tagged both migrates as `push`.
- Default/backfill equipment for existing and new moves: **Any**.
- Uses: shown to the client on the shared plan (future module), per-row
  variant choice, library organization, icon-as-thumbnail-fallback.

## Data model

```
movement_type enum: 'push' | 'pull' | 'static'

equipment:            id, coach_id FK, name (unique per coach, lower), image_url NULL,
                      is_fallback boolean NOT NULL DEFAULT false, created_at
exercise_equipment:   exercise_id FK cascade + equipment_id FK cascade, PK(both)
exercises:            + movement_type NOT NULL DEFAULT 'static'
                      + default_equipment_id NOT NULL FK → equipment
plan_rows:            + equipment_id NULL FK → equipment ON DELETE SET NULL
```

Row semantics: `plan_rows.equipment_id = NULL` means "inherit the move's
default"; it is set explicitly only when the coach picks a variant. Display
always resolves `row.equipment ?? exercise.default_equipment`.

**Invariants (service-enforced):** every move has ≥1 linked equipment and its
default is one of them; exactly one `is_fallback` ("Any") equipment per coach,
which cannot be deleted (rename allowed). Server validates ownership of every
equipment id it receives; membership of a row's equipment in that move's set
is a UI constraint only (decision: not re-checked in savePlanDocument).

**Equipment deletion (aggressive sync, mirrors move deletion):** in one
transaction — moves whose default was the deleted equipment get their first
remaining linked equipment as the new default, else the coach's "Any" (also
re-linked); junction rows cascade; plan rows referencing it revert to NULL
(inherit) via the FK. Never blocks; the confirm dialog states usage impact.

## Migration (live DB, one SQL migration, transactional)

1. DDL: enum, `equipment`, `exercise_equipment`, `exercises.movement_type`
   (NOT NULL DEFAULT 'static'), `exercises.default_equipment_id` (nullable at
   first), `plan_rows.equipment_id`.
2. Per coach, seed 10 equipment rows with bundled icons: Any (`is_fallback`),
   Barbell, Dumbbell, Kettlebell, Cable, Machine, Bodyweight, Resistance
   band, EZ bar, Smith machine.
3. Backfill `movement_type` from existing tags (`push` tag → push, else
   `pull` tag → pull, else static), then delete every tag named push/pull
   (junction cascades).
4. Backfill `default_equipment_id` = the coach's "Any"; insert the matching
   `exercise_equipment` row per move; then `SET NOT NULL`.
5. `plan_rows.equipment_id` stays NULL everywhere (= inherit).

Note: the tag deletion is the only destructive step and is intentional (the
data moves into the enum). Seed script/data updated to match for fresh
installs.

## Icons

`public/equipment/*.svg` — 10 hand-crafted minimal geometric line icons
(24×24 viewBox, `fill="none"`, `stroke="#404040"`, stroke-width 1.75, round
caps/joins): any, barbell, dumbbell, kettlebell, cable, machine, bodyweight,
band, ez-bar, smith-machine. Seed rows point `image_url` at these paths;
coach-created equipment uses the existing upload/URL field (same
`ImageUploadField` as moves) and may have none.

**Thumbnail fallback chain** everywhere a move image renders (library card,
picker row, editor row card): move `image_url` → resolved equipment's
`image_url` (library/picker use the move's default; editor row uses the
row-resolved equipment) → the existing generic Dumbbell placeholder.

## Services / actions / validation

- `src/services/equipment.ts`: `listEquipment` (with per-item usage count),
  `createEquipment`, `updateEquipment` (name/imageUrl), `deleteEquipment`
  (sync logic above; refuses only `is_fallback`). Coach-scoped, ActionResult
  actions with zod (`name` 1–60; `imageUrl` url-or-empty), unique-name
  conflict mapped like tags/moves.
- Exercises: `listExercises` additionally returns `movementType`,
  `defaultEquipmentId`, and `equipment: {id,name,imageUrl}[]`;
  create/update accept `movementType`, `equipmentIds` (min 1),
  `defaultEquipmentId` (must be ∈ `equipmentIds` — zod refine) and diff the
  junction.
- Plans: `EditorRow` + `equipmentId`; `getPlanForEditor` selects it;
  `planDocumentSchema` rows get optional nullable `equipmentId` (uuid);
  `savePlanDocument` ownership-checks all non-null row equipment ids in the
  same style as exercise ids and persists them.

## UI

1. **Library** gains an **Equipment** tab (Moves | Warm-ups | Equipment):
   rows show icon (or placeholder), name, muted "used by N moves", edit
   (EquipmentFormSheet: name + image upload/URL, BottomSheet) and delete
   (confirm dialog stating impact; "Any" shows no delete).
2. **Move form sheet**: movement-type single-select chip row (Push/Pull/
   Static), equipment multi-select (mirrors TagMultiSelect incl. inline
   create by name), and a "Default equipment" Select constrained to the
   chosen ones (create-mode preselects Any; when exactly one equipment is
   selected it is forced as default).
3. **Library moves list**: movement-type chip group (All/Push/Pull/Static)
   rendered as a second filter row above the tag chips; move cards show a
   small outline movement-type chip beside the tags and use the thumbnail
   fallback chain.
4. **Exercise picker (editor)**: thumbnail fallback chain; tapping a move
   with >1 equipment expands an inline equipment-chip row (icon + name) —
   tapping a chip adds the row with that explicit `equipmentId`; a move with
   exactly 1 equipment adds directly with `equipmentId: null` (inherit).
5. **Editor row card**: an equipment chip (icon + name, resolved
   row → default) near the exercise name; tapping opens a small BottomSheet
   listing the move's equipment; selection is a pure-local `setRowField`
   (zero-latency, saved by the explicit Save).
6. **Client card** (variant B): line 1 name + right `ChevronRight` (muted);
   line 2 phone; line 3 muted `N plans · updated <relative>`; the right-side
   badge/timestamp column is removed.

## Out of scope

Share-view/PDF rendering of equipment (that module is still unbuilt — this
spec only guarantees the data is there), equipment filter in the library
(type + tags only for now), custom icon picker (upload/URL only).

## Verification

Per task: typecheck/lint/build. Controller capstone: run the migration
against the live DB and verify counts (all moves defaulted to Any with
junction rows; push/pull tags gone; movement types match prior tags); then a
browser pass at 390 (mobile emulation) + 1280 covering: equipment tab CRUD
incl. delete-with-reassignment, move create/edit with type + equipment +
default, both filter rows, icon fallbacks in library/picker/editor rows,
picker variant pick → row chip shows it, row chip switch → Save → reload
persists, client card layout, and an editor zero-latency regression. Visual
gate applies (screenshots at both widths).
