ALTER TABLE "devices" ADD COLUMN "device_model" TEXT;
ALTER TABLE "devices" ADD COLUMN "os_version" TEXT;
ALTER TABLE "devices" ADD COLUMN "user_agent" TEXT;
ALTER TABLE "devices" ADD COLUMN "last_ip_address" TEXT;

CREATE TABLE "user_security_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "platform" "DevicePlatform",
    "device_model" TEXT,
    "os_version" TEXT,
    "app_version" TEXT,
    "device_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_security_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_security_events_user_id_idx" ON "user_security_events"("user_id");
CREATE INDEX "user_security_events_action_idx" ON "user_security_events"("action");
CREATE INDEX "user_security_events_created_at_idx" ON "user_security_events"("created_at");

ALTER TABLE "user_security_events" ADD CONSTRAINT "user_security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
