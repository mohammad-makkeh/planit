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
