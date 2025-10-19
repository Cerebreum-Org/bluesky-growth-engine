-- Run this SQL in your Supabase SQL Editor or Dashboard

-- Remove foreign key constraints to allow dangling references
ALTER TABLE bluesky_posts DROP CONSTRAINT IF EXISTS bluesky_posts_author_did_fkey;
ALTER TABLE bluesky_reposts DROP CONSTRAINT IF EXISTS bluesky_reposts_subject_uri_fkey;
ALTER TABLE bluesky_reposts DROP CONSTRAINT IF EXISTS bluesky_reposts_author_did_fkey;
ALTER TABLE bluesky_likes DROP CONSTRAINT IF EXISTS bluesky_likes_subject_uri_fkey;
ALTER TABLE bluesky_likes DROP CONSTRAINT IF EXISTS bluesky_likes_author_did_fkey;

-- Verify constraints are gone
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name
FROM pg_constraint 
WHERE conname LIKE '%_fkey' 
AND conrelid::regclass::text LIKE 'bluesky_%';

