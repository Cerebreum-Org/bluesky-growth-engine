# Collecting Maximum Bluesky Users

## Important Limitations

**You cannot get ALL Bluesky users** (20+ million) through social graph crawling because:

1. **Social Graph Method**: The crawler starts from your account and follows connections (followers/following)
2. **Network Islands**: Many users aren't connected to your network (private accounts, new users, isolated communities)
3. **API Rate Limits**: Bluesky's API has rate limits to prevent abuse
4. **Supabase Limits**: Free tier has 500MB database limit (~200k-500k users depending on data)

## What You CAN Collect

- **Your extended network**: Everyone within N degrees of separation from your starting points
- **Estimated reach**: With 5-6 degrees from popular accounts, you can reach 1-5 million users
- **Best coverage**: Use multiple popular seed accounts from different communities

## Maximum Coverage Strategy

### Option 1: Enhanced Collection (Recommended)

Uses multiple popular seed accounts to maximize coverage:

```bash
npm run collect:all
```

This crawls from:
- Bluesky team members
- Popular accounts across niches
- High-follower accounts

**Expected**: 1-5 million users (depending on how long you run it)

### Option 2: Unlimited Custom Collection

```bash
MAX_USERS=999999999 MAX_DEGREES=6 npm run dev
```

**Settings**:
- `MAX_USERS`: Set to a huge number (essentially unlimited)
- `MAX_DEGREES`: Higher = wider reach (but exponentially slower)
  - 3 degrees: ~50k-200k users
  - 4 degrees: ~200k-1M users  
  - 5 degrees: ~1M-5M users
  - 6 degrees: ~5M+ users (takes days/weeks)

### Option 3: Add Your Own Seeds

Edit `src/collect-all.ts` and add accounts from communities you want to cover:

```typescript
const seedHandles = [
  'pfrazee.com',
  'your-target-account.bsky.social',
  'another-account.bsky.social',
  // Add 20-50 popular accounts from different niches
];
```

## To Get ACTUALLY ALL Users

You would need to use Bluesky's **Firehose/Relay** which streams all network activity:

### Firehose Approach (Advanced)
```bash
# This requires different tools
npm install @atproto/sync
# Subscribe to the firehose and collect DIDs as they appear
```

**Pros**: Gets truly ALL users as they post
**Cons**: 
- Requires 24/7 running server
- High bandwidth (~100GB+/month)
- Complex setup
- Still won't get inactive users

## Practical Recommendations

### For Analysis/Research
```bash
# Collect 100k users (takes ~1-2 hours)
MAX_USERS=100000 MAX_DEGREES=4 npm run dev
```

### For Comprehensive Database
```bash
# Collect 1M users (takes ~10-20 hours)
MAX_USERS=1000000 MAX_DEGREES=5 npm run collect:all
```

### For Maximum Coverage
```bash
# Run continuously for days
MAX_USERS=999999999 MAX_DEGREES=6 npm run collect:all
```

## Monitoring Progress

Watch the dashboard while collecting:
```bash
# Terminal 1
npm run collect:all

# Terminal 2  
npm run frontend
# Open http://localhost:3000
```

## Database Considerations

### Supabase Free Tier Limits
- **500MB database**: ~200k-500k users
- **50k active users/month**: Should be fine for read-only dashboard
- **2GB bandwidth**: Will run out with heavy crawling

### Upgrade Path
If you hit limits:
1. **Supabase Pro**: $25/mo for 8GB database (~3-4M users)
2. **Self-hosted PostgreSQL**: Unlimited
3. **Batch export**: Export to CSV and restart fresh

## Performance Tips

1. **Lower rate limit** if you're not hitting API limits:
   ```bash
   RATE_LIMIT_DELAY_MS=25 npm run collect:all
   ```

2. **Run on a server** (not laptop) for long collections:
   - Digital Ocean Droplet: $6/mo
   - Railway: $5-10/mo
   - AWS EC2 t3.micro: ~$8/mo

3. **Resume after interruption**: The script deduplicates, so just restart

## Realistic Expectations

| Time | Users Collected | Coverage |
|------|----------------|----------|
| 1 hour | ~50k-100k | Your immediate network |
| 6 hours | ~200k-500k | 3-4 degrees out |
| 24 hours | ~500k-1M | Most of your network bubble |
| 1 week | ~1M-5M | Significant portion of active Bluesky |
| 1 month | ~5M-10M | Majority of active users |

## Current Defaults (After Changes)

- **MAX_USERS**: 1,000,000 (1M)
- **MAX_DEGREES**: 5
- **RATE_LIMIT_DELAY**: 50ms

To run indefinitely:
```bash
MAX_USERS=999999999 npm run collect:all
```

Press `Ctrl+C` to stop whenever you want!
