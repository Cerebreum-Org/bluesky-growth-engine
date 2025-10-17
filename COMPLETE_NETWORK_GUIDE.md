# Complete Bluesky Network Collection Guide

## 🎯 Goal: Store ENTIRE Bluesky Social Graph

This guide explains how to collect **all 20+ million Bluesky users** using the AT Protocol Firehose.

## 🔥 Firehose Method (THE SOLUTION)

The firehose is a real-time stream of ALL activity on Bluesky. Every post, like, follow, and profile update streams through it.

### How It Works

1. **Connect**: Subscribe to Bluesky's firehose relay (`wss://bsky.network`)
2. **Capture**: Extract user DIDs from every event (posts, follows, likes, etc.)
3. **Fetch**: Periodically fetch full profiles for discovered DIDs
4. **Store**: Batch insert into Supabase

### Run Firehose Collector

```bash
npm run firehose
```

This will:
- ✅ Run 24/7 collecting ALL new users in real-time
- ✅ Capture users as they post, update profiles, or interact
- ✅ Build complete database over time (2-4 weeks to get most users)
- ✅ Auto-resumes if interrupted (deduplicates existing DIDs)

## 💰 Costs & Requirements

### Database Costs

| Users | Storage | Supabase Plan | Monthly Cost |
|-------|---------|---------------|--------------|
| 500k | 500MB | Free | $0 |
| 4M | 4GB | Pro | $25 |
| 10M | 10GB | Pro + extras | $25-50 |
| 20M | 20GB | Pro + extras | $50-100 |

**Recommendation**: Start with Pro ($25/mo) and scale up as needed.

### Bandwidth Costs

- **Firehose**: ~50-100GB/month incoming data
- **Supabase Free**: 2GB egress/month
- **Supabase Pro**: 50GB egress/month

### Server Requirements

**Must run 24/7** - Cannot run on laptop:

**Budget Options:**
- **Railway**: $5-10/mo (easiest)
- **Digital Ocean**: $6/mo (droplet)
- **Fly.io**: $3-8/mo
- **AWS t3.micro**: $8/mo

**Requirements:**
- Always-on server
- Stable internet connection
- 1GB RAM minimum
- Node.js 18+

## 📊 Timeline & Progress

### Expected Collection Rate

- **New users per day**: ~50k-100k (active users)
- **Week 1**: ~500k users
- **Week 2**: ~1.5M users
- **Week 4**: ~3-5M users
- **2-3 months**: ~15-20M users (entire network)

### Why So Slow?

- Only captures users who are **active** (posting, liking, following)
- Inactive users won't appear until they do something
- Historical users require backfilling (see below)

## 🚀 Complete Collection Strategy

### Phase 1: Firehose (Active Users)

```bash
# Run on server 24/7
npm run firehose
```

Captures all active users in real-time.

### Phase 2: Backfill (Historical Users)

```bash
# Run social graph crawler for historical users
MAX_USERS=999999999 MAX_DEGREES=6 npm run collect:all
```

Gets inactive users who won't appear in firehose.

### Phase 3: Combine Both

Run both simultaneously:

```bash
# Terminal 1 - Firehose
npm run firehose

# Terminal 2 - Backfill crawler
MAX_USERS=5000000 npm run collect:all
```

## 🖥️ Production Deployment

### Deploy to Railway (Easiest)

1. Create account at [railway.app](https://railway.app)
2. Create new project
3. Connect to GitHub repo
4. Add environment variables:
   ```
   BLUESKY_HANDLE=your-handle
   BLUESKY_PASSWORD=your-password
   SUPABASE_URL=your-url
   SUPABASE_KEY=your-key
   ```
5. Set start command: `npm run firehose`

### Deploy to Digital Ocean

```bash
# Create droplet
doctl compute droplet create bluesky-collector \
  --image ubuntu-22-04-x64 \
  --size s-1vcpu-1gb \
  --region nyc1

# SSH and setup
ssh root@your-droplet-ip
git clone your-repo
cd bluesky-growth-engine
npm install
npm run build

# Run with PM2
npm install -g pm2
pm2 start npm --name firehose -- run firehose
pm2 save
pm2 startup
```

## 📈 Monitoring

### Watch Progress Dashboard

```bash
# Terminal 1 - Firehose on server
npm run firehose

# Terminal 2 - Frontend locally
npm run frontend
# Open http://localhost:3000
```

### Check Supabase Dashboard

- Database size
- Row count
- API usage
- Bandwidth

### Set Up Alerts

Create a monitoring script:

```bash
# Check database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# Count users
psql $DATABASE_URL -c "SELECT COUNT(*) FROM bluesky_users;"
```

## ⚡ Performance Optimization

### 1. Increase Batch Size

Edit `src/firehose-collector.ts`:
```typescript
const BATCH_SIZE = 500; // Default is 100
```

### 2. Faster Profile Fetching

```typescript
const PROFILE_FETCH_INTERVAL = 30000; // 30s instead of 60s
```

### 3. Multiple Collectors

Run multiple instances with different relays:
- `wss://bsky.network` (official)
- Other public relays (if available)

### 4. Database Indexes

Already included in schema, but verify:
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_indexed_at 
ON bluesky_users(indexed_at DESC);
```

## 🛑 Stopping & Resuming

### Graceful Shutdown

Press `Ctrl+C` - it will:
- Finish processing current batch
- Save pending users
- Show final statistics

### Resume Collection

Just restart:
```bash
npm run firehose
```

It automatically:
- Loads existing DIDs from database
- Skips duplicates
- Continues where it left off

## 📊 Database Optimization

### Partition Tables (For 10M+ Users)

```sql
-- Partition by indexed date
CREATE TABLE bluesky_users_2024_01 PARTITION OF bluesky_users
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Automatically routes queries to right partition
```

### Vacuum Regularly

```sql
VACUUM ANALYZE bluesky_users;
VACUUM ANALYZE bluesky_follows;
```

### Archive Old Data

```sql
-- Move inactive users to archive table
CREATE TABLE bluesky_users_archive AS
SELECT * FROM bluesky_users
WHERE updated_at < NOW() - INTERVAL '6 months';

DELETE FROM bluesky_users
WHERE did IN (SELECT did FROM bluesky_users_archive);
```

## 🔒 Data Privacy & Ethics

### Considerations

- ✅ All data is publicly available (no scraping private accounts)
- ✅ Respecting rate limits
- ✅ Not storing private/deleted content
- ⚠️ Be aware of data regulations (GDPR, CCPA)

### Best Practices

1. **Respect robots.txt** and platform ToS
2. **Don't resell data** without permission
3. **Anonymize if sharing** publicly
4. **Delete on request** if users ask

## 🆘 Troubleshooting

### Firehose Disconnects

```bash
# Add auto-reconnect
# Already built into the collector
```

### Rate Limit Errors

```typescript
// Increase delay in processProfileQueue
await new Promise(resolve => setTimeout(resolve, 100)); // 50 -> 100ms
```

### Database Full

```bash
# Upgrade Supabase plan
# Or archive old data
# Or export and start fresh
```

### Memory Leaks

```bash
# Use PM2 with auto-restart
pm2 start npm --name firehose --max-memory-restart 500M -- run firehose
```

## 📈 Success Metrics

After 1 month running 24/7, you should have:
- ✅ 3-5 million users
- ✅ 20-50 million relationships
- ✅ Complete profile data
- ✅ Real-time updates

## 🎯 Next Steps

1. **Start Firehose**: `npm run firehose` (run on server)
2. **Upgrade Supabase**: Switch to Pro ($25/mo)
3. **Deploy to Server**: Railway/DO/AWS
4. **Monitor Progress**: Check dashboard daily
5. **Optimize**: Tune batch sizes and intervals

## 💡 Pro Tips

- Run firehose at night to save bandwidth
- Use compression for database backups
- Set up Grafana for monitoring
- Export to S3/GCS for long-term storage
- Consider read replicas for dashboard

---

**Ready to collect the entire network?**

```bash
npm run firehose
```

Let it run for 2-4 weeks and you'll have millions of users! 🚀
