-- Add last_backfilled_at and backfill_version to track per-user backfill status
ALTER TABLE IF EXISTS bluesky_users
  ADD COLUMN IF NOT EXISTS last_backfilled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS backfill_version TEXT;

-- Helper partial index to find stale users quickly
CREATE INDEX IF NOT EXISTS idx_bluesky_users_backfill_needed
  ON bluesky_users (did)
  WHERE last_backfilled_at IS NULL OR last_backfilled_at < NOW() - INTERVAL '7 days';
