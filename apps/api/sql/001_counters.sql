-- One row per counter. The API upserts id = 'clicks'.
CREATE TABLE IF NOT EXISTS counters (
  id text PRIMARY KEY,
  value bigint NOT NULL CHECK (value >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
