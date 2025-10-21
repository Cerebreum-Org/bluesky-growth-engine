-- Create checkpoint table for tracking backfill progress
CREATE TABLE IF NOT EXISTS backfill_checkpoints (
  id TEXT PRIMARY KEY,
  last_processed_index INTEGER NOT NULL DEFAULT 0,
  processed_users INTEGER NOT NULL DEFAULT 0,
  collected_posts INTEGER NOT NULL DEFAULT 0,
  collected_likes INTEGER NOT NULL DEFAULT 0,
  collected_reposts INTEGER NOT NULL DEFAULT 0,
  collected_follows INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert initial checkpoint
INSERT INTO backfill_checkpoints (id) VALUES ('main')
ON CONFLICT (id) DO NOTHING;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_backfill_checkpoints_updated 
ON backfill_checkpoints(updated_at DESC);
