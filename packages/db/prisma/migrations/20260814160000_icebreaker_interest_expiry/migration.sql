-- AlterTable
ALTER TABLE "icebreaker_interests" ADD COLUMN "expires_at" TIMESTAMP(3);
ALTER TABLE "icebreaker_interests" ADD COLUMN "expired_at" TIMESTAMP(3);
ALTER TABLE "icebreaker_interests" ADD COLUMN "unanswered_acknowledged_at" TIMESTAMP(3);

-- Backfill active yes interests with a 10-minute window from when they were sent
UPDATE "icebreaker_interests"
SET "expires_at" = "created_at" + INTERVAL '10 minutes'
WHERE "interested" = true
  AND "expires_at" IS NULL
  AND "expired_at" IS NULL
  AND "created_at" > NOW() - INTERVAL '10 minutes';

-- Expire stale yes interests that were waiting too long
UPDATE "icebreaker_interests"
SET "interested" = false,
    "expired_at" = NOW(),
    "expires_at" = NULL
WHERE "interested" = true
  AND "expires_at" IS NULL
  AND "expired_at" IS NULL
  AND "created_at" <= NOW() - INTERVAL '10 minutes';

-- CreateIndex
CREATE INDEX "icebreaker_interests_interested_expires_at_idx" ON "icebreaker_interests"("interested", "expires_at");
