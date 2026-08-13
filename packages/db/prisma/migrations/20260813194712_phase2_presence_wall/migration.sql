-- CreateEnum
CREATE TYPE "WallPostStatus" AS ENUM ('active', 'hidden', 'deleted', 'moderated');

-- CreateEnum
CREATE TYPE "WallReplyStatus" AS ENUM ('active', 'hidden', 'deleted');

-- CreateTable
CREATE TABLE "presence_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "fuzzy_lat" DOUBLE PRECISION,
    "fuzzy_lng" DOUBLE PRECISION,
    "location_accuracy" DOUBLE PRECISION,
    "location_updated_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "presence_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wall_posts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "status" "WallPostStatus" NOT NULL DEFAULT 'active',
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "wall_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wall_replies" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" VARCHAR(300) NOT NULL,
    "status" "WallReplyStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wall_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" UUID NOT NULL,
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presence_sessions_user_id_key" ON "presence_sessions"("user_id");

-- CreateIndex
CREATE INDEX "presence_sessions_latitude_longitude_idx" ON "presence_sessions"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "wall_posts_latitude_longitude_idx" ON "wall_posts"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "wall_posts_created_at_idx" ON "wall_posts"("created_at");

-- CreateIndex
CREATE INDEX "wall_posts_status_idx" ON "wall_posts"("status");

-- CreateIndex
CREATE INDEX "wall_replies_post_id_idx" ON "wall_replies"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_blocker_id_blocked_id_key" ON "blocks"("blocker_id", "blocked_id");

-- AddForeignKey
ALTER TABLE "presence_sessions" ADD CONSTRAINT "presence_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wall_posts" ADD CONSTRAINT "wall_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wall_replies" ADD CONSTRAINT "wall_replies_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "wall_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wall_replies" ADD CONSTRAINT "wall_replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
