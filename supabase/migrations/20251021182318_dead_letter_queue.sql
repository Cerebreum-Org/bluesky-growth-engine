BEGIN;
CREATE TABLE IF NOT EXISTS bluesky_dead_letters (
  id bigserial PRIMARY KEY,
  table text NOT NULL,
  payload jsonb NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dead_letters_table ON bluesky_dead_letters(table);
COMMIT;
