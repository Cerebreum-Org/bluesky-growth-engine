-- Migration: Add missing profile fields
-- Run this if you already have the bluesky_users table created

-- Add banner field
ALTER TABLE bluesky_users ADD COLUMN IF NOT EXISTS banner TEXT;

-- Add labels (moderation labels)
ALTER TABLE bluesky_users ADD COLUMN IF NOT EXISTS labels JSONB;

-- Add associated data (verified links, etc.)
ALTER TABLE bluesky_users ADD COLUMN IF NOT EXISTS associated JSONB;

-- Add viewer relationship fields
ALTER TABLE bluesky_users ADD COLUMN IF NOT EXISTS viewer_muted BOOLEAN;
ALTER TABLE bluesky_users ADD COLUMN IF NOT EXISTS viewer_blocked_by BOOLEAN;
ALTER TABLE bluesky_users ADD COLUMN IF NOT EXISTS viewer_blocking BOOLEAN;
ALTER TABLE bluesky_users ADD COLUMN IF NOT EXISTS viewer_following BOOLEAN;
ALTER TABLE bluesky_users ADD COLUMN IF NOT EXISTS viewer_followed_by BOOLEAN;

-- Create index for viewer relationships (useful for filtering)
CREATE INDEX IF NOT EXISTS idx_bluesky_users_viewer_following ON bluesky_users(viewer_following) WHERE viewer_following = true;
CREATE INDEX IF NOT EXISTS idx_bluesky_users_viewer_followed_by ON bluesky_users(viewer_followed_by) WHERE viewer_followed_by = true;
