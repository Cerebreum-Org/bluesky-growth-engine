# Dynamic Social Graph Collection Strategy

## Overview

This new collection strategy **expands your network dynamically** by discovering and indexing new users as you crawl the social graph. Instead of filtering out unknown users, we add them to the database!

## How It Works

### 🌱 Snowball Sampling

1. **Start with seed users** (your existing 782k users = Generation 0)
2. **Collect their follows** and check each followed user
3. **If user is unknown**, fetch their profile and add to database (Generation 1)
4. **Save ALL follow relationships** (not just internal ones)
5. **Continue expanding** as you discover more users

### 📊 Generation Tracking

Each user gets a `generation` number showing their distance from seed users:

- **Generation 0**: Your original 782k seed users
- **Generation 1**: Users discovered directly from gen 0 (1 degree away)
- **Generation 2**: Users discovered from gen 1 (2 degrees away)
- **And so on...**

This lets you analyze network structure and focus on closer connections.

## Setup Instructions

### 1. Add Generation Column

Run this SQL in your **Supabase SQL Editor**:

\`\`\`sql
-- Add generation column to track distance from seed users
ALTER TABLE bluesky_users 
ADD COLUMN IF NOT EXISTS generation INTEGER DEFAULT 0;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_bluesky_users_generation 
ON bluesky_users(generation);

-- Update existing users to generation 0 (seed users)
UPDATE bluesky_users 
SET generation = 0 
WHERE generation IS NULL;
\`\`\`

Or copy from: `supabase/add-generation-column.sql`

### 2. Run the Dynamic Collector

\`\`\`bash
npm run collect:follows-dynamic
\`\`\`

## What You'll See

\`\`\`
Progress: 1,000/782,698 (0.1%) | Follows: 45,230 | Discovered: 12,450 users | Rate: 50/min | ETA: 260min
\`\`\`

- **Follows**: Total follow relationships saved
- **Discovered**: New users added to database
- **Rate**: Users processed per minute

## Expected Results

### Network Growth

With 782k seed users, you can expect:

- **Generation 1**: ~2-5 million users (people your seeds follow/followed by)
- **Generation 2**: ~10-50 million users (expands rapidly)
- **Follows**: ~50-200 million relationships

⚠️ **Warning**: This grows FAST! The network can expand to millions of users.

### Database Size

- **Generation 0-1**: ~3-5 GB (manageable)
- **Generation 0-2**: ~30-100 GB (large)
- **Generation 0-3**: Potentially hundreds of GB

## Configuration

Edit constants in `src/collect-follows-dynamic.ts`:

\`\`\`typescript
const CONCURRENCY = 15;              // Parallel workers
const MAX_FOLLOWS_PER_USER = 5000;   // Limit per user
const USER_FETCH_BATCH_SIZE = 25;    // Profiles fetched at once
\`\`\`

## Limiting Growth

To prevent infinite expansion, you can:

### Option 1: Stop After One Generation

Run the collector once, then analyze Generation 1 before continuing.

### Option 2: Filter by Followers

Only add users with minimum follower counts:

\`\`\`typescript
// In fetchUserProfiles(), add filter:
if (profile.followersCount && profile.followersCount >= 100) {
  return profile; // Only add if 100+ followers
}
\`\`\`

### Option 3: Set a User Cap

Stop when reaching a target number:

\`\`\`typescript
const MAX_TOTAL_USERS = 5_000_000; // Stop at 5M users

if (knownUserDids.size + discoveredUsers >= MAX_TOTAL_USERS) {
  console.log('Reached user cap, stopping...');
  break;
}
\`\`\`

## Querying by Generation

Once collected, you can analyze by generation:

\`\`\`sql
-- Count users per generation
SELECT generation, COUNT(*) 
FROM bluesky_users 
GROUP BY generation 
ORDER BY generation;

-- Get Gen 1 influencers
SELECT handle, followers_count 
FROM bluesky_users 
WHERE generation = 1 
  AND followers_count > 10000
ORDER BY followers_count DESC;

-- Find connections between generations
SELECT 
  u1.generation as from_gen,
  u2.generation as to_gen,
  COUNT(*) as connections
FROM bluesky_follows f
JOIN bluesky_users u1 ON f.follower_did = u1.did
JOIN bluesky_users u2 ON f.following_did = u2.did
GROUP BY u1.generation, u2.generation;
\`\`\`

## Comparison

### Old Strategy (Filtered)
- ✅ Controlled database size
- ✅ Fast collection
- ❌ Incomplete social graph
- ❌ Only internal connections

### New Strategy (Dynamic)
- ✅ Complete social graph
- ✅ All connections captured
- ✅ Network expansion analytics
- ❌ Can grow very large
- ❌ Slower (fetches profiles)

## Best Practice

**Start Small → Scale Up:**

1. Run on **100 users** first to test
2. Check generation distribution
3. Estimate final size
4. Adjust filters if needed
5. Run full collection

## Tips

- **Monitor disk space** on Supabase
- **Set follower minimums** to control growth
- **Stop after Gen 1** and analyze before continuing
- **Use indexes** on generation column
- **Consider costs** for large Supabase storage

---

## Example Output

\`\`\`
╔════════════════════════════════════════════════════════╗
║              COLLECTION COMPLETE!                      ║
╚════════════════════════════════════════════════════════╝

Statistics:
  - Seed users: 782,698
  - Users processed: 782,698
  - New users discovered: 3,421,567
  - Total users now: 4,204,265
  - Follow relationships: 156,782,943
  - Duration: 8.4 hours
\`\`\`

This shows the network expanded from 782k to 4.2M users (5.4x growth) with 156M connections!
