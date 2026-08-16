-- Separate toggle for "someone nearby turned Break the ice on" proximity alerts.
ALTER TABLE "user_settings"
ADD COLUMN IF NOT EXISTS "allow_push_icebreaker_nearby" BOOLEAN NOT NULL DEFAULT true;
