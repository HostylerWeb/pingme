-- Deduplicate token hashes before unique indexes (keep newest row)
DELETE FROM refresh_tokens a
USING refresh_tokens b
WHERE a.token_hash = b.token_hash
  AND a.created_at < b.created_at;

DELETE FROM password_reset_tokens a
USING password_reset_tokens b
WHERE a.token_hash = b.token_hash
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_token_hash_key ON refresh_tokens(token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_hash_key ON password_reset_tokens(token_hash);

ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS otp_codes_code_hash_idx ON otp_codes(code_hash);
