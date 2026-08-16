-- Partial indexes for admin live-map queries (Wall + icebreaker online users).
CREATE INDEX IF NOT EXISTS presence_sessions_active_fuzzy_idx
  ON presence_sessions (user_id)
  WHERE is_active = true AND fuzzy_lat IS NOT NULL AND fuzzy_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_available_active_idx
  ON users (id)
  WHERE is_available = true AND deleted_at IS NULL AND status = 'active';
