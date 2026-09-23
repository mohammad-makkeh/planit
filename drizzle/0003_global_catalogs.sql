CREATE TABLE "exercise_muscle_targets" (
	"exercise_id" uuid NOT NULL,
	"muscle_target_id" uuid NOT NULL,
	CONSTRAINT "exercise_muscle_targets_exercise_id_muscle_target_id_pk" PRIMARY KEY("exercise_id","muscle_target_id")
);
--> statement-breakpoint
CREATE TABLE "muscle_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "equipment" DROP CONSTRAINT "equipment_coach_id_coaches_id_fk";
--> statement-breakpoint
DROP INDEX "equipment_coach_name_uq";--> statement-breakpoint
CREATE TEMP TABLE "equipment_canonical" AS SELECT "id" AS "old_id", first_value("id") OVER (PARTITION BY lower("name") ORDER BY "created_at", "id") AS "new_id" FROM "equipment";--> statement-breakpoint
INSERT INTO "exercise_equipment" ("exercise_id", "equipment_id") SELECT ee."exercise_id", c."new_id" FROM "exercise_equipment" ee JOIN "equipment_canonical" c ON c."old_id" = ee."equipment_id" WHERE c."old_id" <> c."new_id" ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "exercises" SET "default_equipment_id" = c."new_id" FROM "equipment_canonical" c WHERE "exercises"."default_equipment_id" = c."old_id" AND c."old_id" <> c."new_id";--> statement-breakpoint
UPDATE "plan_rows" SET "equipment_id" = c."new_id" FROM "equipment_canonical" c WHERE "plan_rows"."equipment_id" = c."old_id" AND c."old_id" <> c."new_id";--> statement-breakpoint
DELETE FROM "equipment" WHERE "id" IN (SELECT "old_id" FROM "equipment_canonical" WHERE "old_id" <> "new_id");--> statement-breakpoint
DROP TABLE "equipment_canonical";--> statement-breakpoint
ALTER TABLE "exercise_muscle_targets" ADD CONSTRAINT "exercise_muscle_targets_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscle_targets" ADD CONSTRAINT "exercise_muscle_targets_muscle_target_id_muscle_targets_id_fk" FOREIGN KEY ("muscle_target_id") REFERENCES "public"."muscle_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "muscle_targets_name_uq" ON "muscle_targets" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_name_uq" ON "equipment" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "equipment" DROP COLUMN "coach_id";--> statement-breakpoint
INSERT INTO "muscle_targets" ("name", "position") VALUES ('Upper Chest', 0), ('Middle Chest', 1), ('Lower Chest', 2), ('Lats', 3), ('Upper Back', 4), ('Lower Back', 5), ('Front Shoulder', 6), ('Side Shoulder', 7), ('Rear Shoulder', 8), ('Biceps', 9), ('Triceps', 10), ('Forearms', 11), ('Abs', 12), ('Obliques', 13), ('Glutes', 14), ('Quads', 15), ('Hamstrings', 16), ('Calves', 17);
