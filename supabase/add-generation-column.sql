-- Add generation column to track distance from seed users
-- Generation 0 = original seed users
-- Generation 1 = users discovered in first degree connections
-- Generation 2 = users discovered from gen 1 connections, etc.

ALTER TABLE bluesky_users 
ADD COLUMN IF NOT EXISTS generation INTEGER DEFAULT 0;

-- Add index for efficient querying by generation
CREATE INDEX IF NOT EXISTS idx_bluesky_users_generation 
ON bluesky_users(generation);

-- Update existing users to generation 0 (seed users)
UPDATE bluesky_users 
SET generation = 0 
WHERE generation IS NULL;

-- Add comment
COMMENT ON COLUMN bluesky_users.generation IS 'Network distance from seed users (0 = seed, 1+ = discovered)';
