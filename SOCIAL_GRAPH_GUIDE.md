# Social Graph Collection for 132K Users

## Overview

Build a complete social graph with:
- ✅ **Posts** (with engagement metrics: likes, reposts, replies, quotes)
- ✅ **Follows/Followers** (who follows whom)
- ✅ **Likes** (what users like)
- ✅ **Reposts** (what users repost)
- ✅ **Engagement Stats** (materialized view for analytics)

## Setup

### 1. Run Database Schema

Copy and run `supabase/schema_social_graph.sql` in your Supabase SQL Editor.

This creates:
- `bluesky_posts` table
- `bluesky_likes` table
- `bluesky_reposts` table
- `user_engagement_stats` materialized view
- Indexes for efficient queries

### 2. Run Backfill Script

```bash
npm run backfill:graph
```

This will:
- Load all 132k users from your database
- Collect up to 100 posts per user (~13M posts total)
- Collect all follows/followers relationships
- Store everything in Supabase with batch inserts

**Estimated time**: 13-20 hours for 132k users

## What Gets Collected

### Posts
- Post text
- Engagement metrics (likes, reposts, replies, quotes)
- Reply threading (parent/root)
- Embeds (images, links, videos)
- Timestamps

### Follows
- Who follows whom
- Bidirectional relationships
- Up to 1000 follows per user

### Engagement Stats (Materialized View)
Aggregated stats per user:
- Total posts made
- Total likes given
- Total reposts made
- Total likes received
- Total reposts received
- Total replies received

## Progress Monitoring

Watch the progress:

```bash
npm run backfill:graph

# Output:
Progress: 10/132000 users | Posts: 856 | Follows: 2431
Progress: 20/132000 users | Posts: 1702 | Follows: 4892
...
```

## Data Size Estimates

| Users | Posts | Follows | Storage |
|-------|-------|---------|---------|
| 132k | ~13M | ~26M | ~15-20GB |

**You'll need Supabase Pro** ($25/mo for 8GB, plus $0.125/GB overage)

Or **Team plan** ($599/mo for 100GB)

For 132k users, expect **~$40-60/mo** in Supabase costs.

## Example Queries

### Most engaging users
```sql
SELECT * FROM user_engagement_stats
ORDER BY total_likes_received DESC
LIMIT 100;
```

### Find mutual connections
```sql
SELECT 
  f1.follower_did,
  f1.following_did,
  u1.handle as follower_handle,
  u2.handle as following_handle
FROM bluesky_follows f1
JOIN bluesky_follows f2 
  ON f1.follower_did = f2.following_did 
  AND f1.following_did = f2.follower_did
JOIN bluesky_users u1 ON f1.follower_did = u1.did
JOIN bluesky_users u2 ON f1.following_did = u2.did
LIMIT 1000;
```

### Top posts by engagement
```sql
SELECT 
  p.*,
  u.handle,
  u.display_name
FROM bluesky_posts p
JOIN bluesky_users u ON p.author_did = u.did
ORDER BY (p.like_count + p.repost_count * 2) DESC
LIMIT 100;
```

### User influence score
```sql
SELECT 
  u.handle,
  u.followers_count,
  s.total_likes_received,
  s.total_reposts_received,
  (u.followers_count + s.total_likes_received + s.total_reposts_received * 2) as influence_score
FROM bluesky_users u
JOIN user_engagement_stats s ON u.did = s.did
ORDER BY influence_score DESC
LIMIT 100;
```

## Network Graph Analysis

### Export for Gephi/NetworkX

```sql
-- Export edges (follows)
COPY (
  SELECT 
    u1.handle as source,
    u2.handle as target
  FROM bluesky_follows f
  JOIN bluesky_users u1 ON f.follower_did = u1.did
  JOIN bluesky_users u2 ON f.following_did = u2.did
) TO '/tmp/network_edges.csv' CSV HEADER;

-- Export nodes (users with metrics)
COPY (
  SELECT 
    u.handle as id,
    u.display_name as label,
    u.followers_count,
    s.total_likes_received as likes,
    s.total_reposts_received as reposts
  FROM bluesky_users u
  JOIN user_engagement_stats s ON u.did = s.did
) TO '/tmp/network_nodes.csv' CSV HEADER;
```

## Performance Tips

### 1. Run During Off-Hours
Run the backfill at night when Bluesky API has less traffic.

### 2. Adjust Rate Limits
If you hit rate limits, increase the delay in `src/backfill-social-graph.ts`:

```typescript
const RATE_LIMIT_DELAY = 200; // Increase from 100ms
```

### 3. Process in Chunks
Stop and resume anytime with Ctrl+C - it automatically skips existing data.

### 4. Refresh Stats Periodically
After adding more data:

```sql
SELECT refresh_engagement_stats();
```

## Resume After Interruption

The script automatically deduplicates:
- Posts by URI
- Follows by (follower_did, following_did)
- Likes by URI
- Reposts by URI

Just restart `npm run backfill:graph` and it will skip existing records.

## Cost-Saving Tips

### 1. Limit Posts Per User
Edit `src/backfill-social-graph.ts`:

```typescript
const MAX_POSTS_PER_USER = 50; // Reduce from 100
```

Saves ~50% storage.

### 2. Limit Follows Per User
```typescript
const maxFollows = 500; // Reduce from 1000
```

Saves storage but loses some network edges.

### 3. Skip Inactive Users
Filter out users with 0 posts or 0 followers before processing.

## What's Next?

### Visualize the Network
- Export to Gephi for network visualization
- Use NetworkX in Python for analysis
- Build custom visualization in frontend

### Run Network Analysis
- Community detection
- Influence scores
- Information flow
- Trend analysis

### Keep Updated
- Run backfill periodically (weekly/monthly)
- Or use firehose to capture new posts in real-time

## Troubleshooting

### Database Full
Upgrade Supabase plan or delete old posts:

```sql
DELETE FROM bluesky_posts 
WHERE created_at < NOW() - INTERVAL '6 months';
```

### Rate Limit Errors
Increase `RATE_LIMIT_DELAY` to 200-500ms.

### Memory Issues
Process users in smaller batches - modify the script to process 10k at a time.

---

## Ready to Build Your Social Graph?

```bash
# 1. Run schema in Supabase SQL Editor
# Copy supabase/schema_social_graph.sql

# 2. Start backfill
npm run backfill:graph

# 3. Wait 13-20 hours

# 4. Query your complete social graph!
```

Expected results after completion:
- ✅ ~13 million posts
- ✅ ~26 million follow relationships  
- ✅ Complete engagement metrics
- ✅ Ready for network analysis
