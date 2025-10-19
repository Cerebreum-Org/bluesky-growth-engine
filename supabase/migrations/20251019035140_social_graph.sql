-- Extended Schema for Complete Social Graph
-- Run this to add posts, likes, reposts, and engagement tracking

-- Posts table
CREATE TABLE IF NOT EXISTS bluesky_posts (
  uri TEXT PRIMARY KEY,
  cid TEXT NOT NULL,
  author_did TEXT NOT NULL REFERENCES bluesky_users(did) ON DELETE CASCADE,
  text TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  reply_parent TEXT,
  reply_root TEXT,
  embed_type TEXT,
  embed_uri TEXT,
  like_count INTEGER DEFAULT 0,
  repost_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  quote_count INTEGER DEFAULT 0,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Likes table
CREATE TABLE IF NOT EXISTS bluesky_likes (
  uri TEXT PRIMARY KEY,
  author_did TEXT NOT NULL REFERENCES bluesky_users(did) ON DELETE CASCADE,
  subject_uri TEXT NOT NULL,
  subject_cid TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reposts table
CREATE TABLE IF NOT EXISTS bluesky_reposts (
  uri TEXT PRIMARY KEY,
  author_did TEXT NOT NULL REFERENCES bluesky_users(did) ON DELETE CASCADE,
  subject_uri TEXT NOT NULL REFERENCES bluesky_posts(uri) ON DELETE CASCADE,
  subject_cid TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_posts_author ON bluesky_posts(author_did);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON bluesky_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_reply_parent ON bluesky_posts(reply_parent);
CREATE INDEX IF NOT EXISTS idx_posts_like_count ON bluesky_posts(like_count DESC);

CREATE INDEX IF NOT EXISTS idx_likes_author ON bluesky_likes(author_did);
CREATE INDEX IF NOT EXISTS idx_likes_subject ON bluesky_likes(subject_uri);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON bluesky_likes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reposts_author ON bluesky_reposts(author_did);
CREATE INDEX IF NOT EXISTS idx_reposts_subject ON bluesky_reposts(subject_uri);
CREATE INDEX IF NOT EXISTS idx_reposts_created_at ON bluesky_reposts(created_at DESC);

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_bluesky_posts_updated_at
  BEFORE UPDATE ON bluesky_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Materialized view for user engagement stats
CREATE MATERIALIZED VIEW IF NOT EXISTS user_engagement_stats AS
SELECT 
  u.did,
  u.handle,
  COUNT(DISTINCT p.uri) as post_count,
  COUNT(DISTINCT l.uri) as like_count,
  COUNT(DISTINCT r.uri) as repost_count,
  SUM(p.like_count) as total_likes_received,
  SUM(p.repost_count) as total_reposts_received,
  SUM(p.reply_count) as total_replies_received
FROM bluesky_users u
LEFT JOIN bluesky_posts p ON u.did = p.author_did
LEFT JOIN bluesky_likes l ON u.did = l.author_did
LEFT JOIN bluesky_reposts r ON u.did = r.author_did
GROUP BY u.did, u.handle;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_engagement_stats_did ON user_engagement_stats(did);

-- Function to refresh engagement stats
CREATE OR REPLACE FUNCTION refresh_engagement_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_engagement_stats;
END;
$$ LANGUAGE plpgsql;
