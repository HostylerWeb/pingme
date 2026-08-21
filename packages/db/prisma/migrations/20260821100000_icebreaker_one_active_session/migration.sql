-- Keep only the newest active session per user, then enforce uniqueness
UPDATE icebreaker_sessions
SET status = 'cancelled'
WHERE status = 'active'
  AND id NOT IN (
    SELECT kept.id
    FROM (
      SELECT DISTINCT ON (user_id) id
      FROM icebreaker_sessions
      WHERE status = 'active'
      ORDER BY user_id, created_at DESC
    ) AS kept
  );

CREATE UNIQUE INDEX IF NOT EXISTS icebreaker_sessions_one_active_per_user
  ON icebreaker_sessions (user_id)
  WHERE status = 'active';
