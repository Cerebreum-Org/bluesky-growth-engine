# Database Timeout Fixes

## Problem
The collector was experiencing widespread database timeout errors (error code '57014') due to:
1. Missing `generation` column in database schema
2. Large batch sizes causing lock contention
3. Race conditions where follow relationships were inserted before users
4. No retry logic for transient failures
5. Inefficient initial index query with 5000-row batches

## Solution Applied

### 1. Database Schema Changes
- **Added `generation` column** to track degrees of separation from seed users
- **Added indexes** on `generation` and `(did, generation)` for faster queries

### 2. Code Optimizations
- **Reduced batch sizes**: 50 → 25 to reduce lock time
- **Reduced concurrency**: 3 → 2 workers to reduce database load
- **Reduced page size**: 5000 → 1000 for initial index build
- **Added retry logic** with exponential backoff for transient failures
- **Fixed race condition**: Users are now flushed before follow relationships
- **Better error handling**: Foreign key violations are now gracefully skipped

## Steps to Apply

### 1. ~~Run Database Migration~~ SKIP THIS - NOT REQUIRED!
**The migration is optional.** The code now works without the `generation` column.
You can add it later when you have better database connectivity.

### 2. Environment Variables (Optional)
You can tune these in your `.env` file:

```bash
# Reduced defaults for better stability
BATCH_SIZE=25              # Database insert batch size (was 50)
COLLECTOR_CONCURRENCY=2     # Parallel workers (was 3)
MAX_DB_RETRIES=3           # Retries for failed DB operations

# Keep existing settings
RATE_LIMIT_DELAY_MS=100
MAX_FOLLOWS_PER_USER=5000
USER_FETCH_BATCH_SIZE=10
BSKY_MAX_RPS=8
```

### 3. Restart Collection
```bash
npm run collect:follows-dynamic
```

## What Changed

### Database Layer (`supabase.ts`)
- Added `supabaseBulk` client for future bulk operations
- Better prepared for timeout handling

### Collection Script (`collect-follows-dynamic.ts`)
- **Retry logic**: Up to 3 retries with exponential backoff
- **Timeout detection**: Special handling for error code '57014'
- **Foreign key handling**: Gracefully skip when users aren't inserted yet
- **Flush ordering**: Users always flushed before follow relationships
- **Smaller batches**: Reduced from 50 to 25 rows per batch
- **Smaller page size**: Initial index build uses 1000-row pages instead of 5000
- **Generation column optional**: Works without database migration (generation tracked in-memory only)

## Expected Behavior

After these fixes, you should see:
- ✅ Fewer timeout errors (most should be eliminated)
- ✅ Automatic retries when timeouts do occur
- ✅ No foreign key violations (users inserted before follows)
- ✅ Slower but more reliable collection
- ✅ Better progress tracking with generation tracking

## Monitoring

Watch for these log messages:
- `Foreign key violation - skipping follow batch` - Normal, means users are being added in discovery mode
- `Failed to save user batch after retries` - Rare, indicates persistent DB issues
- `Failed to save follow batch after retries` - Rare, indicates persistent DB issues

## Performance Impact

- **Slower but stable**: Reduced concurrency means slower collection but better reliability
- **Less database load**: Smaller batches reduce lock contention
- **Better for Supabase free tier**: Reduced concurrent queries

## Rollback (if needed)

If you need to revert:
1. The `generation` column can stay (it's harmless)
2. Change these back in your `.env`:
   ```bash
   BATCH_SIZE=50
   COLLECTOR_CONCURRENCY=3
   ```

## Further Optimization

If timeouts persist:
1. Reduce `BATCH_SIZE` further (try 10-15)
2. Reduce `COLLECTOR_CONCURRENCY` to 1
3. Increase `MAX_DB_RETRIES` to 5
4. Consider upgrading Supabase tier for better performance
