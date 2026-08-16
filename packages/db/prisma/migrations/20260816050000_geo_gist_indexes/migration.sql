-- PostGIS GiST indexes for proximity queries (expression indexes; not modeled in Prisma schema)
CREATE INDEX IF NOT EXISTS wall_posts_geo_gix ON wall_posts
  USING GIST ((ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography));

CREATE INDEX IF NOT EXISTS presence_sessions_geo_gix ON presence_sessions
  USING GIST ((ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography))
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS icebreaker_sessions_geo_gix ON icebreaker_sessions
  USING GIST ((ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography));
