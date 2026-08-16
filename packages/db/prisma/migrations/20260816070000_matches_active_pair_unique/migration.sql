-- One active/pending match per ordered user pair (rematch after declined/expired still allowed)
CREATE UNIQUE INDEX IF NOT EXISTS matches_active_pair_uidx
  ON matches (user_a_id, user_b_id)
  WHERE status IN ('pending', 'active');
