-- 🧵 THREAD STRUCTURE
CREATE TABLE IF NOT EXISTS bluesky_threads (
  id BIGSERIAL PRIMARY KEY,
  post_uri TEXT NOT NULL UNIQUE,
  author_did TEXT NOT NULL,
  parent_uri TEXT, -- Direct reply parent
  root_uri TEXT,   -- Thread root
  thread_depth INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_threads_author ON bluesky_threads(author_did);
CREATE INDEX IF NOT EXISTS idx_threads_parent ON bluesky_threads(parent_uri);
CREATE INDEX IF NOT EXISTS idx_threads_root ON bluesky_threads(root_uri);
CREATE INDEX IF NOT EXISTS idx_threads_depth ON bluesky_threads(thread_depth);

-- 📝 MENTIONS NETWORK
CREATE TABLE IF NOT EXISTS bluesky_mentions (
  id BIGSERIAL PRIMARY KEY,
  post_uri TEXT NOT NULL,
  author_did TEXT NOT NULL,
  mentioned_handle TEXT NOT NULL,
  mentioned_did TEXT, -- Resolved DID
  position INTEGER, -- Position in text
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mentions_post ON bluesky_mentions(post_uri);
CREATE INDEX IF NOT EXISTS idx_mentions_author ON bluesky_mentions(author_did);
CREATE INDEX IF NOT EXISTS idx_mentions_handle ON bluesky_mentions(mentioned_handle);
CREATE INDEX IF NOT EXISTS idx_mentions_did ON bluesky_mentions(mentioned_did);

-- 🏷️ HASHTAGS & TOPICS
CREATE TABLE IF NOT EXISTS bluesky_hashtags (
  id BIGSERIAL PRIMARY KEY,
  post_uri TEXT NOT NULL,
  author_did TEXT NOT NULL,
  hashtag TEXT NOT NULL,
  normalized_tag TEXT NOT NULL, -- Lowercase, trimmed
  position INTEGER, -- Position in text
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hashtags_post ON bluesky_hashtags(post_uri);
CREATE INDEX IF NOT EXISTS idx_hashtags_tag ON bluesky_hashtags(normalized_tag);
CREATE INDEX IF NOT EXISTS idx_hashtags_author ON bluesky_hashtags(author_did);
CREATE INDEX IF NOT EXISTS idx_hashtags_created ON bluesky_hashtags(created_at);

-- Hashtag trends aggregation
CREATE TABLE IF NOT EXISTS bluesky_hashtag_trends (
  id BIGSERIAL PRIMARY KEY,
  hashtag TEXT NOT NULL,
  day_bucket DATE NOT NULL,
  hour_bucket TIMESTAMPTZ NOT NULL,
  post_count INTEGER DEFAULT 1,
  unique_authors INTEGER DEFAULT 1,
  engagement_score FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(hashtag, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_trends_hashtag ON bluesky_hashtag_trends(hashtag);
CREATE INDEX IF NOT EXISTS idx_trends_day ON bluesky_hashtag_trends(day_bucket);
CREATE INDEX IF NOT EXISTS idx_trends_hour ON bluesky_hashtag_trends(hour_bucket);

-- 🖼️ MEDIA & RICH CONTENT
CREATE TABLE IF NOT EXISTS bluesky_media (
  id BIGSERIAL PRIMARY KEY,
  post_uri TEXT NOT NULL,
  author_did TEXT NOT NULL,
  media_type TEXT NOT NULL, -- 'image', 'video', 'link', 'embed'
  media_url TEXT,
  media_cid TEXT, -- Content identifier
  alt_text TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  dimensions JSONB, -- {width: x, height: y}
  metadata JSONB, -- Additional media metadata
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_post ON bluesky_media(post_uri);
CREATE INDEX IF NOT EXISTS idx_media_type ON bluesky_media(media_type);
CREATE INDEX IF NOT EXISTS idx_media_author ON bluesky_media(author_did);

-- External links tracking
CREATE TABLE IF NOT EXISTS bluesky_links (
  id BIGSERIAL PRIMARY KEY,
  post_uri TEXT NOT NULL,
  author_did TEXT NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT,
  description TEXT,
  position INTEGER, -- Position in text
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_links_post ON bluesky_links(post_uri);
CREATE INDEX IF NOT EXISTS idx_links_domain ON bluesky_links(domain);
CREATE INDEX IF NOT EXISTS idx_links_author ON bluesky_links(author_did);

-- ⏰ TEMPORAL ACTIVITY PATTERNS
CREATE TABLE IF NOT EXISTS bluesky_activity_patterns (
  id BIGSERIAL PRIMARY KEY,
  author_did TEXT NOT NULL,
  hour_of_day INTEGER NOT NULL, -- 0-23
  day_of_week INTEGER NOT NULL, -- 0-6 (Sunday=0)
  post_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  repost_count INTEGER DEFAULT 0,
  avg_engagement FLOAT DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(author_did, hour_of_day, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_activity_author ON bluesky_activity_patterns(author_did);
CREATE INDEX IF NOT EXISTS idx_activity_hour ON bluesky_activity_patterns(hour_of_day);
CREATE INDEX IF NOT EXISTS idx_activity_dow ON bluesky_activity_patterns(day_of_week);
