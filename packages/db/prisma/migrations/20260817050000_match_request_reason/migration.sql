-- Store why someone requested a wall connect
ALTER TABLE "matches" ADD COLUMN "request_reason_code" VARCHAR(64);
ALTER TABLE "matches" ADD COLUMN "request_reason_detail" VARCHAR(500);
