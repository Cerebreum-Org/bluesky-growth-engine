-- Create bluesky_users table
CREATE TABLE IF NOT EXISTS bluesky_users (
  did TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  avatar TEXT,
  banner TEXT,
  followers_count INTEGER,
  following_count INTEGER,
  posts_count INTEGER,
  labels JSONB,
  associated JSONB,
  viewer_muted BOOLEAN,
  viewer_blocked_by BOOLEAN,
  viewer_blocking BOOLEAN,
  viewer_following BOOLEAN,
  viewer_followed_by BOOLEAN,
  created_at TIMESTAMPTZ,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generation INTEGER DEFAULT 0
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bluesky_users_handle ON bluesky_users(handle);
CREATE INDEX IF NOT EXISTS idx_bluesky_users_followers ON bluesky_users(followers_count DESC);
CREATE INDEX IF NOT EXISTS idx_bluesky_users_indexed_at ON bluesky_users(indexed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bluesky_users_generation ON bluesky_users(generation);
CREATE INDEX IF NOT EXISTS idx_bluesky_users_did_generation ON bluesky_users(did, generation);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_bluesky_users_updated_at
  BEFORE UPDATE ON bluesky_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create bluesky_follows table to capture follower/following relationships
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
