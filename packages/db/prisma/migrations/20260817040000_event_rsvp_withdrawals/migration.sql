-- Track RSVP withdrawals with reasons (admin analytics)
CREATE TABLE "event_rsvp_withdrawals" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "previous_status" "EventRsvpStatus" NOT NULL,
    "reason_code" VARCHAR(64) NOT NULL,
    "reason_detail" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_rsvp_withdrawals_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "event_rsvp_withdrawals" ADD CONSTRAINT "event_rsvp_withdrawals_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_rsvp_withdrawals" ADD CONSTRAINT "event_rsvp_withdrawals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "event_rsvp_withdrawals_event_id_idx" ON "event_rsvp_withdrawals"("event_id");
CREATE INDEX "event_rsvp_withdrawals_user_id_idx" ON "event_rsvp_withdrawals"("user_id");
