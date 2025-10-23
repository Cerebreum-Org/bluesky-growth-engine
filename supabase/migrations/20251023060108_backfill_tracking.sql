-- Add backfill tracking column to bluesky_users
-- Tracks when each user was last enriched with historical data

ALTER TABLE bluesky_users 
ADD COLUMN IF NOT EXISTS last_backfilled_at TIMESTAMPTZ;

-- Add index for efficient querying of users needing backfill
CREATE INDEX IF NOT EXISTS idx_users_backfill_needed 
ON bluesky_users (last_backfilled_at) 
WHERE last_backfilled_at IS NULL OR description IS NULL OR avatar IS NULL;

-- Add comment
COMMENT ON COLUMN bluesky_users.last_backfilled_at IS 'Timestamp of last comprehensive backfill (profile + historical data enrichment)';
