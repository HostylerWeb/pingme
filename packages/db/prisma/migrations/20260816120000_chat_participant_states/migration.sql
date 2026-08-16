CREATE TABLE "chat_participant_states" (
    "user_id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "hidden_at" TIMESTAMP(3),
    "visible_after" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_participant_states_pkey" PRIMARY KEY ("user_id","chat_id")
);

CREATE INDEX "chat_participant_states_user_id_hidden_at_idx" ON "chat_participant_states"("user_id", "hidden_at");

ALTER TABLE "chat_participant_states" ADD CONSTRAINT "chat_participant_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_participant_states" ADD CONSTRAINT "chat_participant_states_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
