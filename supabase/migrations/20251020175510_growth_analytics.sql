-- Migration: Growth Analytics and Historical Tracking
-- Description: Tables and views for bluefacts.app-style analytics

-- ========================================
-- USER SNAPSHOTS - Track follower growth over time
-- ========================================
CREATE TABLE IF NOT EXISTS user_snapshots (
  id BIGSERIAL PRIMARY KEY,
  did TEXT NOT NULL REFERENCES bluesky_users(did) ON DELETE CASCADE,
  followers_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  posts_count INTEGER NOT NULL DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_snapshots_did ON user_snapshots(did);
CREATE INDEX IF NOT EXISTS idx_user_snapshots_snapshot_at ON user_snapshots(snapshot_at);
CREATE INDEX IF NOT EXISTS idx_user_snapshots_did_snapshot ON user_snapshots(did, snapshot_at DESC);

-- ========================================
-- POST SNAPSHOTS - Track post engagement over time
-- ========================================
CREATE TABLE IF NOT EXISTS post_snapshots (
  id BIGSERIAL PRIMARY KEY,
  uri TEXT NOT NULL REFERENCES bluesky_posts(uri) ON DELETE CASCADE,
  like_count INTEGER NOT NULL DEFAULT 0,
  repost_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  quote_count INTEGER NOT NULL DEFAULT 0,
  total_engagement INTEGER NOT NULL DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_snapshots_uri ON post_snapshots(uri);
CREATE INDEX IF NOT EXISTS idx_post_snapshots_snapshot_at ON post_snapshots(snapshot_at);
CREATE INDEX IF NOT EXISTS idx_post_snapshots_uri_snapshot ON post_snapshots(uri, snapshot_at DESC);

-- ========================================
-- MATERIALIZED VIEW: Trending Accounts (24h follower growth)
-- ========================================
CREATE MATERIALIZED VIEW IF NOT EXISTS trending_accounts AS
WITH latest_snapshots AS (
  SELECT DISTINCT ON (did)
    did,
    followers_count as current_followers,
    snapshot_at as current_snapshot
  FROM user_snapshots
  WHERE snapshot_at >= NOW() - INTERVAL '25 hours'
  ORDER BY did, snapshot_at DESC
),
day_ago_snapshots AS (
  SELECT DISTINCT ON (did)
    did,
    followers_count as previous_followers,
    snapshot_at as previous_snapshot
  FROM user_snapshots
  WHERE snapshot_at >= NOW() - INTERVAL '25 hours'
    AND snapshot_at <= NOW() - INTERVAL '23 hours'
  ORDER BY did, snapshot_at DESC
)
SELECT 
  u.did,
  u.handle,
  u.display_name,
  u.avatar,
  u.description,
  u.followers_count,
  l.current_followers,
  COALESCE(l.current_followers - d.previous_followers, 0) as followers_gained_24h,
  CASE 
    WHEN d.previous_followers > 0 
    THEN ROUND(((l.current_followers - d.previous_followers)::NUMERIC / d.previous_followers * 100)::NUMERIC, 2)
    ELSE 0 
  END as growth_percentage_24h,
  l.current_snapshot,
  d.previous_snapshot
FROM bluesky_users u
LEFT JOIN latest_snapshots l ON u.did = l.did
LEFT JOIN day_ago_snapshots d ON u.did = d.did
WHERE l.current_followers IS NOT NULL
ORDER BY followers_gained_24h DESC NULLS LAST;

CREATE INDEX IF NOT EXISTS idx_trending_followers_gained ON trending_accounts(followers_gained_24h DESC);

-- ========================================
-- MATERIALIZED VIEW: Fastest Growing Accounts
-- ========================================
CREATE MATERIALIZED VIEW IF NOT EXISTS fastest_growing_accounts AS
WITH latest_snapshots AS (
  SELECT DISTINCT ON (did)
    did,
    followers_count as current_followers,
    snapshot_at as current_snapshot
  FROM user_snapshots
  WHERE snapshot_at >= NOW() - INTERVAL '25 hours'
  ORDER BY did, snapshot_at DESC
),
day_ago_snapshots AS (
  SELECT DISTINCT ON (did)
    did,
    followers_count as previous_followers,
    snapshot_at as previous_snapshot
  FROM user_snapshots
  WHERE snapshot_at >= NOW() - INTERVAL '25 hours'
    AND snapshot_at <= NOW() - INTERVAL '23 hours'
  ORDER BY did, snapshot_at DESC
)
SELECT 
  u.did,
  u.handle,
  u.display_name,
  u.avatar,
  u.description,
  u.followers_count,
  l.current_followers,
  COALESCE(l.current_followers - d.previous_followers, 0) as followers_gained_24h,
  CASE 
    WHEN d.previous_followers > 0 
    THEN ROUND(((l.current_followers - d.previous_followers)::NUMERIC / d.previous_followers * 100)::NUMERIC, 2)
    ELSE 0 
  END as growth_percentage_24h,
  l.current_snapshot,
  d.previous_snapshot
FROM bluesky_users u
LEFT JOIN latest_snapshots l ON u.did = l.did
LEFT JOIN day_ago_snapshots d ON u.did = d.did
WHERE l.current_followers IS NOT NULL
  AND d.previous_followers > 0
  AND d.previous_followers >= 100
ORDER BY growth_percentage_24h DESC NULLS LAST;

CREATE INDEX IF NOT EXISTS idx_fastest_growing_percentage ON fastest_growing_accounts(growth_percentage_24h DESC);

-- ========================================
-- VIEW: Most Followed Users
-- ========================================
CREATE OR REPLACE VIEW most_followed_users AS
SELECT 
  did,
  handle,
  display_name,
  avatar,
  description,
  followers_count,
  following_count,
  posts_count,
  created_at
FROM bluesky_users
WHERE followers_count > 0
ORDER BY followers_count DESC;

-- ========================================
-- MATERIALIZED VIEW: Top Posts by Engagement (24h)
-- ========================================
CREATE MATERIALIZED VIEW IF NOT EXISTS top_posts_24h AS
SELECT 
  p.uri,
  p.text,
  p.author_did,
  u.handle as author_handle,
  u.display_name as author_name,
  u.avatar as author_avatar,
  p.like_count,
  p.repost_count,
  p.reply_count,
  p.quote_count,
  (p.like_count + p.repost_count * 2 + p.reply_count * 3 + p.quote_count * 2) as engagement_score,
  p.embed_type,
  p.embed_uri,
  p.created_at,
  p.indexed_at
FROM bluesky_posts p
JOIN bluesky_users u ON p.author_did = u.did
WHERE p.created_at >= NOW() - INTERVAL '24 hours'
  AND (p.like_count + p.repost_count + p.reply_count + p.quote_count) > 0
ORDER BY engagement_score DESC;

CREATE INDEX IF NOT EXISTS idx_top_posts_engagement ON top_posts_24h(engagement_score DESC);

-- ========================================
-- MATERIALIZED VIEW: Top Videos by Engagement
-- ========================================
CREATE MATERIALIZED VIEW IF NOT EXISTS top_videos AS
SELECT 
  p.uri,
  p.text,
  p.author_did,
  u.handle as author_handle,
  u.display_name as author_name,
  u.avatar as author_avatar,
  p.like_count,
  p.repost_count,
  p.reply_count,
  p.quote_count,
  (p.like_count + p.repost_count * 2 + p.reply_count * 3 + p.quote_count * 2) as engagement_score,
  p.embed_type,
  p.embed_uri,
  p.created_at,
  p.indexed_at
FROM bluesky_posts p
JOIN bluesky_users u ON p.author_did = u.did
WHERE p.embed_type LIKE '%video%'
  AND p.created_at >= NOW() - INTERVAL '7 days'
ORDER BY engagement_score DESC;

CREATE INDEX IF NOT EXISTS idx_top_videos_engagement ON top_videos(engagement_score DESC);

-- ========================================
-- FUNCTION: Refresh all analytics materialized views
-- ========================================
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_accounts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY fastest_growing_accounts;
  REFRESH MATERIALIZED VIEW CONCURRENTLY top_posts_24h;
  REFRESH MATERIALIZED VIEW CONCURRENTLY top_videos;
END;
$$;

-- ========================================
-- FUNCTION: Get user growth history
-- ========================================
CREATE OR REPLACE FUNCTION get_user_growth_history(
  user_did TEXT,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  snapshot_at TIMESTAMPTZ,
  followers_count INTEGER,
  following_count INTEGER,
  posts_count INTEGER,
  followers_change INTEGER,
  growth_rate NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH snapshots AS (
    SELECT 
      us.snapshot_at,
      us.followers_count,
      us.following_count,
      us.posts_count,
      LAG(us.followers_count) OVER (ORDER BY us.snapshot_at) as prev_followers
    FROM user_snapshots us
    WHERE us.did = user_did
      AND us.snapshot_at >= NOW() - (days_back || ' days')::INTERVAL
    ORDER BY us.snapshot_at
  )
  SELECT 
    s.snapshot_at,
    s.followers_count,
    s.following_count,
    s.posts_count,
    COALESCE(s.followers_count - s.prev_followers, 0) as followers_change,
    CASE 
      WHEN s.prev_followers > 0 
      THEN ROUND(((s.followers_count - s.prev_followers)::NUMERIC / s.prev_followers * 100)::NUMERIC, 2)
      ELSE 0 
    END as growth_rate
  FROM snapshots s;
END;
$$;

COMMENT ON TABLE user_snapshots IS 'Historical snapshots of user follower counts for growth tracking';
COMMENT ON TABLE post_snapshots IS 'Historical snapshots of post engagement metrics';
