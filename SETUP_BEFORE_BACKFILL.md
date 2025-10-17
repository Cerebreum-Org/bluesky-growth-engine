# Setup Before Running Backfill

## ⚠️ IMPORTANT: Run These Steps BEFORE `npm run backfill:graph`

### Step 1: Apply Database Schema

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy the contents of `supabase/schema_social_graph.sql`
4. Paste and run it

This creates:
- ✅ `bluesky_posts` table
- ✅ `bluesky_likes` table
- ✅ `bluesky_reposts` table
- ✅ `user_engagement_stats` materialized view
- ✅ All necessary indexes and triggers

### Step 2: Verify Tables Exist

Run this in Supabase SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('bluesky_posts', 'bluesky_likes', 'bluesky_reposts');
```

You should see all 3 tables.

### Step 3: Run Backfill

```bash
npm run backfill:graph
```

The script will now:
- ✅ Skip foreign key violations (only save follows for users we have)
- ✅ Process all 133k users
- ✅ Take ~13-20 hours
- ✅ Auto-resume if interrupted

### Step 4: Monitor Progress (Optional)

In another terminal:

```bash
# Check progress every few minutes
npm run check:progress
```

### Step 5: After Completion

```bash
# Run analytics
npm run analytics

# Export network for visualization
npm run export:network
```

---

## Troubleshooting

### "Could not find the table 'public.bluesky_posts'"
→ You didn't run Step 1. Apply the schema first.

### Foreign key violations
→ Fixed! The script now skips follows for users not in our database.

### Out of memory
→ The script uses batch processing. Should be fine for 133k users.

### Rate limit errors
→ Increase `RATE_LIMIT_DELAY` in `src/backfill-social-graph.ts` from 100ms to 200ms.

---

## What Gets Collected

For each of your 133,618 users:
- ✅ Up to 100 recent posts
- ✅ All likes on those posts
- ✅ All reposts
- ✅ All follow relationships (filtered to users in your DB)

**Expected results:**
- ~13 million posts
- ~20-26 million follow relationships
- ~15-20GB database storage
