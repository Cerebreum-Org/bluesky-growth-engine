-- Migration: Add generation column and optimize indexes
-- Run this in your Supabase SQL Editor

-- Add generation column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bluesky_users' AND column_name = 'generation'
  ) THEN
    ALTER TABLE bluesky_users ADD COLUMN generation INTEGER DEFAULT 0;
    COMMENT ON COLUMN bluesky_users.generation IS 'Degrees of separation from seed users (0 = seed)';
  END IF;
END $$;

-- Update existing users to generation 0 (they are seed users)
UPDATE bluesky_users SET generation = 0 WHERE generation IS NULL;

-- Create indexes for optimization
CREATE INDEX IF NOT EXISTS idx_bluesky_users_generation ON bluesky_users(generation);
CREATE INDEX IF NOT EXISTS idx_bluesky_users_did_generation ON bluesky_users(did, generation);

-- Analyze tables to update statistics
ANALYZE bluesky_users;
ANALYZE bluesky_follows;

-- Display statistics
SELECT 
  'bluesky_users' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN generation = 0 THEN 1 END) as generation_0,
  COUNT(CASE WHEN generation > 0 THEN 1 END) as generation_1_plus
FROM bluesky_users;

SELECT 'bluesky_follows' as table_name, COUNT(*) as total_rows FROM bluesky_follows;
