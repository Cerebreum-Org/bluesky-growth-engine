-- Content enrichment tables for mentions, hashtags, links, media, threads, activity patterns
BEGIN;

CREATE TABLE IF NOT EXISTS bluesky_threads (
  post_uri text PRIMARY KEY,
  blocker_did text NOT NULL,
  parent_uri text,
  root_uri text,
  thread_depth integer,
  created_at timestamptz,
  indexed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_threads_author ON bluesky_threads(blocker_did);

CREATE TABLE IF NOT EXISTS bluesky_mentions (
  id bigserial PRIMARY KEY,
  post_uri text NOT NULL,
  blocker_did text NOT NULL,
  mentioned_handle text NOT NULL,
  mentioned_did text,
  position integer,
  created_at timestamptz,
  indexed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mentions_post ON bluesky_mentions(post_uri);
CREATE INDEX IF NOT EXISTS idx_mentions_handle ON bluesky_mentions(mentioned_handle);

CREATE TABLE IF NOT EXISTS bluesky_hashtags (
  id bigserial PRIMARY KEY,
  post_uri text NOT NULL,
  blocker_did text NOT NULL,
  hashtag text NOT NULL,
  normalized_tag text,
  position integer,
  created_at timestamptz,
  indexed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hashtags_tag ON bluesky_hashtags(normalized_tag);

CREATE TABLE IF NOT EXISTS bluesky_links (
  id bigserial PRIMARY KEY,
  post_uri text NOT NULL,
  blocker_did text NOT NULL,
  url text NOT NULL,
  domain text,
  position integer,
  created_at timestamptz,
  indexed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_links_domain ON bluesky_links(domain);

CREATE TABLE IF NOT EXISTS bluesky_media (
  id bigserial PRIMARY KEY,
  post_uri text NOT NULL,
  blocker_did text NOT NULL,
  media_type text,
  media_url text,
  media_cid text,
  alt_text text,
  dimensions jsonb,
  metadata jsonb,
  created_at timestamptz,
  indexed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_cid ON bluesky_media(media_cid);

CREATE TABLE IF NOT EXISTS bluesky_activity_patterns (
  blocker_did text NOT NULL,
  hour_of_day int NOT NULL,
  day_of_week int NOT NULL,
  post_count int NOT NULL DEFAULT 0,
  like_count int NOT NULL DEFAULT 0,
  repost_count int NOT NULL DEFAULT 0,
  avg_engagement float8 NOT NULL DEFAULT 0,
  PRIMARY KEY(blocker_did, hour_of_day, day_of_week)
);

COMMIT;
