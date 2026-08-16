CREATE TYPE "UserNotificationType" AS ENUM ('wall_reply_on_post', 'wall_reply_on_thread');

CREATE TABLE "user_notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "UserNotificationType" NOT NULL,
    "post_id" UUID NOT NULL,
    "reply_id" UUID NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "wall_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_reply_id_fkey" FOREIGN KEY ("reply_id") REFERENCES "wall_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "user_notifications_user_id_reply_id_key" ON "user_notifications"("user_id", "reply_id");
CREATE INDEX "user_notifications_user_id_read_at_idx" ON "user_notifications"("user_id", "read_at");
CREATE INDEX "user_notifications_user_id_created_at_idx" ON "user_notifications"("user_id", "created_at");
