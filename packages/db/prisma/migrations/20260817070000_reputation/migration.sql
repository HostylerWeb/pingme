-- CreateEnum
CREATE TYPE "ReputationEventSourceType" AS ENUM (
  'verification_liveness',
  'verification_id',
  'verification_email',
  'verification_phone',
  'activity_first_wall_post',
  'activity_wall',
  'activity_icebreaker_match',
  'activity_weekly_streak',
  'activity_account_age',
  'activity_event_host',
  'activity_event_attend',
  'report_deduction',
  'report_reporter_penalty',
  'admin_adjustment'
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "reputation_score" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "reputation_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "source_type" "ReputationEventSourceType" NOT NULL,
    "source_id" UUID,
    "admin_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reputation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reputation_events_user_id_created_at_idx" ON "reputation_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "reputation_events_user_id_source_type_created_at_idx" ON "reputation_events"("user_id", "source_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reputation_events_user_id_source_type_source_id_key" ON "reputation_events"("user_id", "source_type", "source_id");

-- AddForeignKey
ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reputation_events" ADD CONSTRAINT "reputation_events_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
