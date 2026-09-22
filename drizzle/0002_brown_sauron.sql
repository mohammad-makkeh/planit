ALTER TABLE "plan_rows" ALTER COLUMN "sets" TYPE integer USING NULLIF(substring("sets" from '[0-9]+'), '')::integer;--> statement-breakpoint
ALTER TABLE "plan_rows" ALTER COLUMN "reps" TYPE integer USING NULLIF(substring("reps" from '[0-9]+'), '')::integer;--> statement-breakpoint
ALTER TABLE "plan_rows" ALTER COLUMN "rest" TYPE integer USING NULLIF(substring("rest" from '[0-9]+'), '')::integer;--> statement-breakpoint
ALTER TABLE "plan_rows" ALTER COLUMN "one_rm" TYPE integer USING NULLIF(substring("one_rm" from '[0-9]+'), '')::integer;--> statement-breakpoint
ALTER TABLE "plan_sessions" ADD COLUMN "cardio_incline" integer;--> statement-breakpoint
UPDATE "plan_sessions" SET "cardio_incline" = LEAST(15, GREATEST(0, (substring("cardio_hrm" from 'incline[^0-9]*([0-9]+)'))::integer)) WHERE "cardio_hrm" ~ 'incline[^0-9]*[0-9]+';--> statement-breakpoint
ALTER TABLE "plan_sessions" ALTER COLUMN "cardio_time" TYPE integer USING NULLIF(substring("cardio_time" from '[0-9]+'), '')::integer;--> statement-breakpoint
ALTER TABLE "plan_sessions" ALTER COLUMN "cardio_hrm" TYPE integer USING NULLIF(substring("cardio_hrm" from '[0-9]+'), '')::integer;--> statement-breakpoint
ALTER TABLE "plan_sessions" RENAME COLUMN "cardio_time" TO "cardio_minutes";--> statement-breakpoint
ALTER TABLE "plan_sessions" RENAME COLUMN "cardio_hrm" TO "cardio_bpm";--> statement-breakpoint
ALTER TABLE "plan_sessions" DROP COLUMN "focus_note";--> statement-breakpoint
UPDATE "plans" SET "status" = 'active' WHERE "status" = 'completed';--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."plan_status" RENAME TO "plan_status_old";--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('draft', 'active');--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "status" TYPE "public"."plan_status" USING "status"::text::"public"."plan_status";--> statement-breakpoint
ALTER TABLE "plans" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
DROP TYPE "public"."plan_status_old";
