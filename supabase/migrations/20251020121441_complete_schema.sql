-- Complete Bluesky Growth Engine Schema
-- This includes all tables needed for the jetstream collector

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
  is_quote_post BOOLEAN DEFAULT FALSE,
  quote_target_uri TEXT,
  quote_target_author TEXT,
  quote_chain_root TEXT,
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
  subject_uri TEXT NOT NULL,
  subject_cid TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Blocks table
CREATE TABLE IF NOT EXISTS bluesky_blocks (
  uri TEXT PRIMARY KEY,
  author_did TEXT NOT NULL REFERENCES bluesky_users(did) ON DELETE CASCADE,
  subject_did TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lists table
CREATE TABLE IF NOT EXISTS bluesky_lists (
  uri TEXT PRIMARY KEY,
  cid TEXT NOT NULL,
  author_did TEXT NOT NULL REFERENCES bluesky_users(did) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  purpose TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- List items table
CREATE TABLE IF NOT EXISTS bluesky_list_items (
  uri TEXT PRIMARY KEY,
  cid TEXT NOT NULL,
  list_uri TEXT NOT NULL REFERENCES bluesky_lists(uri) ON DELETE CASCADE,
  subject_did TEXT NOT NULL REFERENCES bluesky_users(did) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Profile update history table
CREATE TABLE IF NOT EXISTS bluesky_profile_updates (
  id SERIAL PRIMARY KEY,
  did TEXT NOT NULL REFERENCES bluesky_users(did) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quote chains analytics table
CREATE TABLE IF NOT EXISTS bluesky_quote_chains (
  id SERIAL PRIMARY KEY,
  root_post_uri TEXT NOT NULL,
  root_post_author TEXT NOT NULL,
  chain_length INTEGER NOT NULL DEFAULT 1,
  total_engagement INTEGER DEFAULT 0,
  participants TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(root_post_uri)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bluesky_posts_author ON bluesky_posts(author_did);
CREATE INDEX IF NOT EXISTS idx_bluesky_posts_created_at ON bluesky_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_bluesky_posts_quote_target ON bluesky_posts(quote_target_uri);
CREATE INDEX IF NOT EXISTS idx_bluesky_posts_quote_chain_root ON bluesky_posts(quote_chain_root);
CREATE INDEX IF NOT EXISTS idx_bluesky_likes_author ON bluesky_likes(author_did);
CREATE INDEX IF NOT EXISTS idx_bluesky_likes_subject ON bluesky_likes(subject_uri);
CREATE INDEX IF NOT EXISTS idx_bluesky_reposts_author ON bluesky_reposts(author_did);
CREATE INDEX IF NOT EXISTS idx_bluesky_reposts_subject ON bluesky_reposts(subject_uri);
CREATE INDEX IF NOT EXISTS idx_bluesky_blocks_author ON bluesky_blocks(author_did);
CREATE INDEX IF NOT EXISTS idx_bluesky_blocks_subject ON bluesky_blocks(subject_did);
CREATE INDEX IF NOT EXISTS idx_bluesky_lists_author ON bluesky_lists(author_did);
CREATE INDEX IF NOT EXISTS idx_bluesky_list_items_list ON bluesky_list_items(list_uri);
CREATE INDEX IF NOT EXISTS idx_bluesky_list_items_subject ON bluesky_list_items(subject_did);
CREATE INDEX IF NOT EXISTS idx_bluesky_profile_updates_did ON bluesky_profile_updates(did);
CREATE INDEX IF NOT EXISTS idx_bluesky_quote_chains_root ON bluesky_quote_chains(root_post_uri);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist and recreate
DROP TRIGGER IF EXISTS update_bluesky_users_updated_at ON bluesky_users;
CREATE TRIGGER update_bluesky_users_updated_at 
    BEFORE UPDATE ON bluesky_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bluesky_posts_updated_at ON bluesky_posts;
CREATE TRIGGER update_bluesky_posts_updated_at 
    BEFORE UPDATE ON bluesky_posts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bluesky_lists_updated_at ON bluesky_lists;
CREATE TRIGGER update_bluesky_lists_updated_at 
    BEFORE UPDATE ON bluesky_lists 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bluesky_quote_chains_updated_at ON bluesky_quote_chains;
CREATE TRIGGER update_bluesky_quote_chains_updated_at 
    BEFORE UPDATE ON bluesky_quote_chains 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
