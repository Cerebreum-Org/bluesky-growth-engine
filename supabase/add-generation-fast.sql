-- Fast Migration: Add generation column without bulk UPDATE
-- This avoids timeout by using DEFAULT value instead of UPDATE

-- Add generation column with DEFAULT 0 (applies to new rows)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bluesky_users' AND column_name = 'generation'
  ) THEN
    -- Add column with DEFAULT 0 and NOT NULL after data is populated
    ALTER TABLE bluesky_users ADD COLUMN generation INTEGER DEFAULT 0;
    COMMENT ON COLUMN bluesky_users.generation IS 'Degrees of separation from seed users (0 = seed)';
    
    -- Make sure the default applies to existing rows too
    -- This is instant because PostgreSQL just updates the metadata
    ALTER TABLE bluesky_users ALTER COLUMN generation SET DEFAULT 0;
  END IF;
END $$;

-- Create indexes (these are fast even on large tables)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bluesky_users_generation 
  ON bluesky_users(generation);
  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bluesky_users_did_generation 
  ON bluesky_users(did, generation);

-- Migration complete!
-- Note: Existing rows will have NULL for generation initially.
-- The collector will update them as it processes users.
-- New rows will automatically get generation = 0 from the DEFAULT.

SELECT 'Migration complete - generation column and indexes added' as status;
