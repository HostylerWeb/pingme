-- CreateEnum
CREATE TYPE "IcebreakerSessionStatus" AS ENUM ('active', 'matched', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "MatchSource" AS ENUM ('icebreaker', 'wall_reply', 'manual');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('pending', 'active', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('active', 'closed', 'blocked');

-- CreateTable
CREATE TABLE "icebreaker_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "status" "IcebreakerSessionStatus" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "matched_session_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "icebreaker_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "user_a_id" UUID NOT NULL,
    "user_b_id" UUID NOT NULL,
    "source" "MatchSource" NOT NULL,
    "source_reference_id" UUID,
    "status" "MatchStatus" NOT NULL DEFAULT 'pending',
    "user_a_accepted_at" TIMESTAMP(3),
    "user_b_accepted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "status" "ChatStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "icebreaker_sessions_user_id_status_idx" ON "icebreaker_sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "icebreaker_sessions_latitude_longitude_idx" ON "icebreaker_sessions"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "icebreaker_sessions_status_expires_at_idx" ON "icebreaker_sessions"("status", "expires_at");

-- CreateIndex
CREATE INDEX "matches_user_a_id_user_b_id_idx" ON "matches"("user_a_id", "user_b_id");

-- CreateIndex
CREATE INDEX "matches_user_a_id_status_idx" ON "matches"("user_a_id", "status");

-- CreateIndex
CREATE INDEX "matches_user_b_id_status_idx" ON "matches"("user_b_id", "status");

-- CreateIndex
CREATE INDEX "matches_status_expires_at_idx" ON "matches"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "chats_match_id_key" ON "chats"("match_id");

-- AddForeignKey
ALTER TABLE "icebreaker_sessions" ADD CONSTRAINT "icebreaker_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
