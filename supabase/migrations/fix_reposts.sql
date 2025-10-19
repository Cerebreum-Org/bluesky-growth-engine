-- Remove foreign key constraint on reposts
ALTER TABLE bluesky_reposts 
  DROP CONSTRAINT IF EXISTS bluesky_reposts_subject_uri_fkey;

-- Allow reposts to reference posts that don't exist yet
-- (We can backfill later)
ALTER TABLE bluesky_reposts 
  ALTER COLUMN subject_uri DROP NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_reposts_subject_orphaned 
  ON bluesky_reposts(subject_uri) 
  WHERE subject_uri IS NOT NULL;
