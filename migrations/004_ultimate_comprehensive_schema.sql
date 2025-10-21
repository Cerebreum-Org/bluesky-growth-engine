-- ULTIMATE Comprehensive Schema for Maximum Bluesky Data Capture
-- This migration creates the complete data infrastructure for comprehensive Bluesky analytics

-- =====================================================
-- COMPREHENSIVE POSTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bluesky_posts_comprehensive (
  id BIGSERIAL PRIMARY KEY,
  uri TEXT NOT NULL UNIQUE,
  cid TEXT NOT NULL,
  author TEXT NOT NULL,
  text TEXT,
  
  -- Reply/Quote relationships
  reply_to TEXT,
  quote_uri TEXT,
  
  -- Rich media analysis
  has_media BOOLEAN DEFAULT FALSE,
  media_count INTEGER DEFAULT 0,
  media_types TEXT[] DEFAULT '{}',
  
  -- Content linguistics
  langs TEXT[] DEFAULT '{}',
  facets_count INTEGER DEFAULT 0,
  mentions_count INTEGER DEFAULT 0,
  links_count INTEGER DEFAULT 0,
  tags_count INTEGER DEFAULT 0,
  
  -- AI predictions
  engagement_prediction DECIMAL(5,4),
  content_category TEXT,
  
  -- Actual performance (for backfill)
  actual_like_count INTEGER DEFAULT 0,
  actual_repost_count INTEGER DEFAULT 0,
  actual_reply_count INTEGER DEFAULT 0,
  
  -- Temporal data
  created_at TIMESTAMPTZ NOT NULL,
  collection_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Performance indexes
  CONSTRAINT valid_engagement_prediction CHECK (engagement_prediction >= 0 AND engagement_prediction <= 1)
);

-- Indexes for comprehensive posts
CREATE INDEX IF NOT EXISTS idx_posts_comprehensive_author ON bluesky_posts_comprehensive(author);
CREATE INDEX IF NOT EXISTS idx_posts_comprehensive_created_at ON bluesky_posts_comprehensive(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_comprehensive_engagement ON bluesky_posts_comprehensive(engagement_prediction DESC, actual_like_count DESC);
CREATE INDEX IF NOT EXISTS idx_posts_comprehensive_media ON bluesky_posts_comprehensive(has_media, media_count);
CREATE INDEX IF NOT EXISTS idx_posts_comprehensive_category ON bluesky_posts_comprehensive(content_category);
CREATE INDEX IF NOT EXISTS idx_posts_comprehensive_collection_time ON bluesky_posts_comprehensive(collection_timestamp DESC);

-- =====================================================
-- COMPREHENSIVE INTERACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bluesky_interactions_comprehensive (
  id BIGSERIAL PRIMARY KEY,
  uri TEXT NOT NULL UNIQUE,
  author TEXT NOT NULL,
  target_uri TEXT NOT NULL,
  target_author TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'repost', 'reply', 'quote', 'mention')),
  
  -- Relationship analytics
  interaction_strength DECIMAL(5,4),
  
  -- Temporal data
  created_at TIMESTAMPTZ NOT NULL,
  collection_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for comprehensive interactions
CREATE INDEX IF NOT EXISTS idx_interactions_comprehensive_author ON bluesky_interactions_comprehensive(author);
CREATE INDEX IF NOT EXISTS idx_interactions_comprehensive_target ON bluesky_interactions_comprehensive(target_author);
CREATE INDEX IF NOT EXISTS idx_interactions_comprehensive_type ON bluesky_interactions_comprehensive(type);
CREATE INDEX IF NOT EXISTS idx_interactions_comprehensive_strength ON bluesky_interactions_comprehensive(interaction_strength DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_comprehensive_created_at ON bluesky_interactions_comprehensive(created_at DESC);

-- =====================================================
-- COMPREHENSIVE SOCIAL GRAPH TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bluesky_social_graph_comprehensive (
  id BIGSERIAL PRIMARY KEY,
  uri TEXT NOT NULL UNIQUE,
  actor TEXT NOT NULL,
  target TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('follow', 'block', 'list_add', 'list_remove')),
  
  -- List relationships
  list_uri TEXT,
  list_name TEXT,
  
  -- Relationship analytics
  relationship_strength DECIMAL(5,4),
  
  -- Temporal data
  created_at TIMESTAMPTZ NOT NULL,
  collection_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for comprehensive social graph
CREATE INDEX IF NOT EXISTS idx_social_graph_comprehensive_actor ON bluesky_social_graph_comprehensive(actor);
CREATE INDEX IF NOT EXISTS idx_social_graph_comprehensive_target ON bluesky_social_graph_comprehensive(target);
CREATE INDEX IF NOT EXISTS idx_social_graph_comprehensive_type ON bluesky_social_graph_comprehensive(type);
CREATE INDEX IF NOT EXISTS idx_social_graph_comprehensive_relationship ON bluesky_social_graph_comprehensive(actor, target, type);
CREATE INDEX IF NOT EXISTS idx_social_graph_comprehensive_strength ON bluesky_social_graph_comprehensive(relationship_strength);
CREATE INDEX IF NOT EXISTS idx_social_graph_comprehensive_list ON bluesky_social_graph_comprehensive(list_uri) WHERE list_uri IS NOT NULL;

-- =====================================================
-- COMPREHENSIVE PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bluesky_profiles_comprehensive (
  id BIGSERIAL PRIMARY KEY,
  did TEXT NOT NULL UNIQUE,
  handle TEXT NOT NULL,
  
  -- Profile data
  display_name TEXT,
  description TEXT,
  avatar TEXT,
  banner TEXT,
  
  -- Statistics
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  
  -- Profile metadata
  labels TEXT[] DEFAULT '{}',
  
  -- Analytics
  profile_strength DECIMAL(5,4),
  activity_level TEXT,
  quality_score DECIMAL(5,4),
  network_depth INTEGER DEFAULT 0,
  
  -- Temporal tracking
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  collection_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_profile_strength CHECK (profile_strength >= 0 AND profile_strength <= 1),
  CONSTRAINT valid_quality_score CHECK (quality_score >= 0 AND quality_score <= 1),
  CONSTRAINT valid_activity_level CHECK (activity_level IN ('low', 'moderate', 'active', 'very_active', 'unknown'))
);

-- Indexes for comprehensive profiles
CREATE INDEX IF NOT EXISTS idx_profiles_comprehensive_handle ON bluesky_profiles_comprehensive(handle);
CREATE INDEX IF NOT EXISTS idx_profiles_comprehensive_followers ON bluesky_profiles_comprehensive(followers_count DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_comprehensive_quality ON bluesky_profiles_comprehensive(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_comprehensive_activity ON bluesky_profiles_comprehensive(activity_level);
CREATE INDEX IF NOT EXISTS idx_profiles_comprehensive_network_depth ON bluesky_profiles_comprehensive(network_depth);
CREATE INDEX IF NOT EXISTS idx_profiles_comprehensive_updated ON bluesky_profiles_comprehensive(updated_at DESC);

-- =====================================================
-- RICH MEDIA TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bluesky_rich_media (
  id BIGSERIAL PRIMARY KEY,
  uri TEXT NOT NULL UNIQUE,
  post_uri TEXT NOT NULL,
  
  -- Media classification
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'audio', 'link', 'embed')),
  media_url TEXT,
  
  -- Image/Video metadata
  alt_text TEXT,
  aspect_ratio TEXT,
  file_size BIGINT,
  duration INTEGER, -- seconds for video/audio
  thumbnail_url TEXT,
  
  -- Link metadata
  link_title TEXT,
  link_description TEXT,
  
  -- Generic embed data
  embed_type TEXT,
  embed_data JSONB,
  
  -- Processing status
  processing_status TEXT DEFAULT 'detected',
  
  -- Temporal data
  collection_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for rich media
CREATE INDEX IF NOT EXISTS idx_rich_media_post_uri ON bluesky_rich_media(post_uri);
CREATE INDEX IF NOT EXISTS idx_rich_media_type ON bluesky_rich_media(media_type);
CREATE INDEX IF NOT EXISTS idx_rich_media_processing ON bluesky_rich_media(processing_status);
CREATE INDEX IF NOT EXISTS idx_rich_media_collection_time ON bluesky_rich_media(collection_timestamp DESC);

-- =====================================================
-- TRENDING SIGNALS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS bluesky_trending_signals (
  id BIGSERIAL PRIMARY KEY,
  content_hash TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('hashtag', 'mention', 'link', 'phrase')),
  content_value TEXT NOT NULL,
  
  -- Source tracking
  post_uri TEXT NOT NULL,
  author TEXT NOT NULL,
  
  -- Trend analytics
  engagement_velocity DECIMAL(10,2) DEFAULT 0,
  trend_score DECIMAL(8,4) DEFAULT 0,
  
  -- Demographic data (when available)
  geographic_data JSONB,
  demographic_data JSONB,
  
  -- Temporal data
  collection_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for trending signals
CREATE INDEX IF NOT EXISTS idx_trending_signals_content_hash ON bluesky_trending_signals(content_hash);
CREATE INDEX IF NOT EXISTS idx_trending_signals_content_type ON bluesky_trending_signals(content_type);
CREATE INDEX IF NOT EXISTS idx_trending_signals_content_value ON bluesky_trending_signals(content_value);
CREATE INDEX IF NOT EXISTS idx_trending_signals_trend_score ON bluesky_trending_signals(trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_trending_signals_engagement ON bluesky_trending_signals(engagement_velocity DESC);
CREATE INDEX IF NOT EXISTS idx_trending_signals_collection_time ON bluesky_trending_signals(collection_timestamp DESC);

-- Composite index for trending analysis
CREATE INDEX IF NOT EXISTS idx_trending_signals_analytics ON bluesky_trending_signals(content_type, trend_score DESC, engagement_velocity DESC);

-- =====================================================
-- BACKFILL CHECKPOINTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS backfill_checkpoints (
  id TEXT PRIMARY KEY,
  phase TEXT NOT NULL CHECK (phase IN ('users', 'posts', 'interactions', 'media', 'trends')),
  cursor TEXT,
  processed_count INTEGER NOT NULL DEFAULT 0,
  total_estimated INTEGER NOT NULL DEFAULT 0,
  depth_level INTEGER NOT NULL DEFAULT 0,
  quality_filter DECIMAL(3,2) NOT NULL DEFAULT 0.7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Index for backfill checkpoints
CREATE INDEX IF NOT EXISTS idx_backfill_checkpoints_created_at ON backfill_checkpoints(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backfill_checkpoints_phase ON backfill_checkpoints(phase);
