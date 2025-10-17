# Quick Start: Collect Entire Bluesky Network

## TL;DR

```bash
# Test locally first (will collect actively posting users)
npm run firehose

# Then deploy to server to run 24/7
# See COMPLETE_NETWORK_GUIDE.md for deployment
```

## What This Does

✅ Connects to Bluesky's firehose (real-time event stream)  
✅ Captures ALL users as they post/interact  
✅ Fetches their full profiles  
✅ Stores in your Supabase database  
✅ Runs continuously to build complete network

## Requirements

### Immediate (Test Locally)
- ✅ Nothing new! You already have everything

### Production (Full Collection)
- 📦 Server running 24/7 ($5-10/mo)
- 💾 Supabase Pro ($25/mo for 8GB storage)

## Expected Results

| Timeframe | Users Collected |
|-----------|----------------|
| 1 week | ~500k |
| 1 month | ~3-5M |
| 2-3 months | ~15-20M (entire network) |

## Commands

```bash
# Test locally
npm run firehose

# Check progress (separate terminal)
npm run frontend
# Open http://localhost:3000

# Stop
Ctrl+C
```

## Next Steps

1. **Test it now**: Run `npm run firehose` locally
2. **Watch it work**: See users being collected in real-time
3. **Deploy to server**: See `COMPLETE_NETWORK_GUIDE.md` when ready for 24/7 collection
4. **Upgrade database**: Switch to Supabase Pro when you hit 500MB

## Costs Summary

- **Testing locally**: $0 (free tier is fine)
- **Full production**: ~$30-40/mo (server + database)
- **At scale (20M users)**: ~$50-100/mo

## FAQs

**Q: Can I run this on my laptop?**  
A: Yes for testing, but no for full collection (needs 24/7 uptime)

**Q: How long until I have all users?**  
A: 2-3 months running 24/7 on a server

**Q: Will this work with free Supabase?**  
A: Yes for ~500k users, then you need Pro ($25/mo)

**Q: Can I stop and resume?**  
A: Yes! It automatically deduplicates existing users

**Q: What about inactive users?**  
A: Combine with social graph crawler: `npm run collect:all`

---

**Ready? Start collecting:**

```bash
npm run firehose
```

Press Ctrl+C to stop anytime.

For full deployment guide, see `COMPLETE_NETWORK_GUIDE.md`
