-- Migration: Add follows table to capture follower/following relationships
-- Run this if you already have the bluesky_users table

-- Create bluesky_follows table to capture the social graph
CREATE TABLE IF NOT EXISTS bluesky_follows (
  follower_did TEXT NOT NULL REFERENCES bluesky_users(did) ON DELETE CASCADE,
  following_did TEXT NOT NULL REFERENCES bluesky_users(did) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_did, following_did)
);

-- Create indexes for efficient relationship queries
CREATE INDEX IF NOT EXISTS idx_bluesky_follows_follower ON bluesky_follows(follower_did);
CREATE INDEX IF NOT EXISTS idx_bluesky_follows_following ON bluesky_follows(following_did);
CREATE INDEX IF NOT EXISTS idx_bluesky_follows_created_at ON bluesky_follows(created_at DESC);

-- Create trigger to auto-update updated_at for follows
CREATE TRIGGER update_bluesky_follows_updated_at
  BEFORE UPDATE ON bluesky_follows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
