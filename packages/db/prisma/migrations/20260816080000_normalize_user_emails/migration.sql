-- Soft-delete case-variant duplicate accounts (keep earliest created_at per lower(email)).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(email)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM users
  WHERE email IS NOT NULL
    AND deleted_at IS NULL
),
duplicates AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE refresh_tokens AS rt
SET revoked_at = NOW()
FROM duplicates AS d
WHERE rt.user_id = d.id
  AND rt.revoked_at IS NULL;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(email)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM users
  WHERE email IS NOT NULL
    AND deleted_at IS NULL
)
UPDATE users AS u
SET
  status = 'deleted',
  deleted_at = NOW(),
  email = NULL,
  phone = NULL,
  password_hash = NULL,
  is_available = false,
  updated_at = NOW()
FROM ranked AS r
WHERE u.id = r.id
  AND r.rn > 1;

-- Normalize remaining emails to lowercase.
UPDATE users
SET email = lower(trim(email)),
    updated_at = NOW()
WHERE email IS NOT NULL
  AND email <> lower(trim(email));

UPDATE admin_users
SET email = lower(trim(email))
WHERE email <> lower(trim(email));

-- Defense in depth: block mixed-case inserts that bypass the API.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uidx
  ON users (lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_lower_uidx
  ON admin_users (lower(email));
