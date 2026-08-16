-- Event comment threading (replies under a top-level comment)
ALTER TABLE "event_comments" ADD COLUMN "parent_id" UUID;

ALTER TABLE "event_comments"
  ADD CONSTRAINT "event_comments_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "event_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "event_comments_parent_id_idx" ON "event_comments"("parent_id");
