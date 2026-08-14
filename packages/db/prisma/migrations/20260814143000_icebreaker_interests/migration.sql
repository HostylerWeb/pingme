-- AlterTable
ALTER TABLE "icebreaker_sessions" ADD COLUMN "show_photo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "icebreaker_sessions" ADD COLUMN "intro_message" VARCHAR(100);

-- CreateTable
CREATE TABLE "icebreaker_interests" (
    "id" UUID NOT NULL,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "interested" BOOLEAN NOT NULL,
    "hidden_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "icebreaker_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "icebreaker_interests_from_user_id_idx" ON "icebreaker_interests"("from_user_id");

-- CreateIndex
CREATE INDEX "icebreaker_interests_to_user_id_idx" ON "icebreaker_interests"("to_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "icebreaker_interests_from_user_id_to_user_id_key" ON "icebreaker_interests"("from_user_id", "to_user_id");

-- AddForeignKey
ALTER TABLE "icebreaker_interests" ADD CONSTRAINT "icebreaker_interests_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "icebreaker_interests" ADD CONSTRAINT "icebreaker_interests_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
