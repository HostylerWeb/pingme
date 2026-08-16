-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('active', 'cancelled', 'hidden', 'deleted', 'moderated');

-- CreateEnum
CREATE TYPE "EventRsvpStatus" AS ENUM ('going', 'maybe', 'cancelled');

-- CreateEnum
CREATE TYPE "EventCommentStatus" AS ENUM ('active', 'hidden', 'deleted');

-- AlterEnum
ALTER TYPE "MatchSource" ADD VALUE 'event';

-- AlterEnum
ALTER TYPE "ReportTargetType" ADD VALUE 'event';
ALTER TYPE "ReportTargetType" ADD VALUE 'event_comment';

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN "allow_push_events_nearby" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "place_name" VARCHAR(200),
    "address" VARCHAR(500),
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "allow_messages" BOOLEAN NOT NULL DEFAULT true,
    "status" "EventStatus" NOT NULL DEFAULT 'active',
    "going_count" INTEGER NOT NULL DEFAULT 0,
    "maybe_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_images" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_rsvps" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "EventRsvpStatus" NOT NULL DEFAULT 'going',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_comments" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "status" "EventCommentStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_latitude_longitude_idx" ON "events"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE INDEX "events_starts_at_idx" ON "events"("starts_at");

-- CreateIndex
CREATE INDEX "events_user_id_idx" ON "events"("user_id");

-- CreateIndex
CREATE INDEX "event_images_event_id_idx" ON "event_images"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_rsvps_event_id_user_id_key" ON "event_rsvps"("event_id", "user_id");

-- CreateIndex
CREATE INDEX "event_rsvps_event_id_idx" ON "event_rsvps"("event_id");

-- CreateIndex
CREATE INDEX "event_rsvps_user_id_idx" ON "event_rsvps"("user_id");

-- CreateIndex
CREATE INDEX "event_comments_event_id_idx" ON "event_comments"("event_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_images" ADD CONSTRAINT "event_images_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PostGIS geo index for events discovery
CREATE INDEX events_geo_gix ON events
  USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography);
