# Applied Migrations to supabase-db

This document tracks which migrations have been applied to the production `supabase-db` container.

## Database Information
- **Container:** `supabase-db`
- **Access:** Via `supabase-kong` on port 8000
- **Studio:** http://100.69.129.86:3001
- **Total Users:** 3.4M+ in `bluesky_users` table

## Applied Migrations (2025-10-22)

### ✅ 20251021074016_new_collections.sql
Applied: 2025-10-22 03:57 UTC
Creates tables for new Bluesky collection types:
- `bluesky_feed_generators`
- `bluesky_threadgates`
- `bluesky_starterpacks`
- `bluesky_labeler_services`

### ✅ 20251021182318_dead_letter_queue.sql (FIXED)
Applied: 2025-10-22 03:57 UTC
Creates dead letter queue for failed insertions:
- `bluesky_dead_letters` (with `table_name` column, not `table`)

**Note:** Original migration file had SQL syntax error (used reserved keyword `table`). Fixed to use `table_name`.

## Complete Table List (24 tables)

1. bluesky_activity_patterns
2. bluesky_blocks
3. bluesky_dead_letters ⭐ NEW
4. bluesky_feed_generators ⭐ NEW
5. bluesky_follows
6. bluesky_hashtag_trends
7. bluesky_hashtags
8. bluesky_labeler_services ⭐ NEW
9. bluesky_likes
10. bluesky_links
11. bluesky_list_items
12. bluesky_lists
13. bluesky_media
14. bluesky_mentions
15. bluesky_posts
16. bluesky_profile_history
17. bluesky_quote_chains
18. bluesky_quote_engagement
19. bluesky_quote_relationships
20. bluesky_reposts
21. bluesky_starterpacks ⭐ NEW
22. bluesky_threadgates ⭐ NEW
23. bluesky_threads
24. bluesky_users

## Script Compatibility

### ✅ Jetstream Collector
**Script:** `src/jetstream-ultimate-collector.ts`
**Command:** `npm run collector:ultimate`
**Status:** All required tables present
- Uses queue-manager.ts which writes to all 24 tables
- Dead letter queue properly configured

### ✅ Social Graph Backfill
**Script:** `src/backfill-social-graph.ts`
**Command:** `npm run backfill:graph`
**Status:** Compatible
- Only writes to `bluesky_users` table

### ✅ Enrichment Backfill
**Script:** `src/backfill-enrichment-from-posts.ts`
**Command:** `npm run backfill:enrichment`
**Status:** Needs verification
- Should be checked for table compatibility

## Next Steps

If adding new migrations:
1. Create migration file in `supabase/migrations/`
2. Apply to `supabase-db`: `docker exec -i supabase-db psql -U postgres -d postgres < migration.sql`
3. Verify tables created: `docker exec supabase-db psql -U postgres -d postgres -c "\dt public.*"`
4. Document here with timestamp
