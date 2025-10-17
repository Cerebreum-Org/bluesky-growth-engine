# Bluesky Growth Engine - Complete Setup

This project has two parts:
1. **Backend** (Node.js/TypeScript) - Crawls and collects Bluesky user data
2. **Frontend** (Next.js) - Dashboard to visualize the collected data

## Quick Start

### 1. Backend Setup (Already Done ✅)

Your backend is already configured and running. It collects users and stores them in Supabase.

```bash
# Run the crawler
npm run dev
```

### 2. Frontend Setup (New! 🎉)

Start the dashboard to view your data:

```bash
# From the root directory
npm run frontend

# Or navigate to frontend directory
cd frontend
npm run dev
```

Then open **http://localhost:3000** in your browser!

## What You'll See

### Dashboard Features

1. **Stats Overview**
   - Total users collected
   - Total relationships mapped
   - Average followers
   - Top user by followers

2. **Follower Distribution Chart**
   - Visualize user distribution by follower count
   - See network composition at a glance

3. **User Browser**
   - Search by handle or name
   - Filter by following/followers
   - Sort by follower count or recent
   - Click to view on Bluesky
   - See relationship badges (following, follower)

## Project Structure

```
bluesky-growth-engine/
├── src/                    # Backend crawler
│   ├── index.ts           # Entry point
│   ├── strategies.ts      # Collection strategies
│   ├── supabase.ts        # Database client
│   └── agent.ts           # Bluesky auth
├── frontend/              # Dashboard
│   ├── app/              # Next.js pages
│   ├── components/       # React components
│   └── lib/              # Utilities
├── supabase/             # Database schema
│   ├── schema.sql        # Full schema
│   └── migrations/       # Schema updates
└── .env                  # Config (not in git)
```

## Common Workflows

### Collect New Data

```bash
# Default: 25k users, 3 degrees
npm run dev

# Custom configuration
MAX_USERS=50000 MAX_DEGREES=4 npm run dev
```

### View Dashboard

```bash
# Start frontend
npm run frontend

# Open http://localhost:3000
```

### Both at Once

Open two terminals:

**Terminal 1 (Backend):**
```bash
npm run dev
```

**Terminal 2 (Frontend):**
```bash
npm run frontend
```

Watch the dashboard update in real-time as new users are collected!

## Environment Variables

### Backend (.env)
```bash
BLUESKY_HANDLE=your-handle.bsky.social
BLUESKY_PASSWORD=your-app-password
SUPABASE_URL=your-project-url
SUPABASE_KEY=your-anon-key

# Optional crawler config
MAX_USERS=25000
MAX_DEGREES=3
RATE_LIMIT_DELAY_MS=100
```

### Frontend (frontend/.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

These should already be configured automatically!

## Troubleshooting

### Backend Issues

**"Could not find 'associated' column"**
→ Run the database migrations in Supabase SQL Editor

**"Failed to save relationship"**
→ Run `migration_add_follows_table.sql`

### Frontend Issues

**"No data showing"**
→ Make sure backend has collected some users first

**"Connection error"**
→ Check `frontend/.env.local` has correct Supabase credentials

**Port already in use**
→ Frontend uses port 3000, backend crawler doesn't use a port

## Deployment

### Backend
- Run on a server/VM with cron jobs
- Use Railway, Render, or Fly.io
- Schedule with GitHub Actions

### Frontend
- Deploy to Vercel (easiest)
- Add environment variables in Vercel dashboard
- Connects directly to your Supabase instance

## Tips

1. **Start Small**: Collect 100-1000 users first to test
2. **Monitor**: Watch Supabase dashboard for database size
3. **Rate Limits**: Increase `RATE_LIMIT_DELAY_MS` if hitting API limits
4. **Refresh**: Frontend auto-refreshes data on page load

## Next Steps

- [ ] Let backend collect data (takes time for large networks)
- [ ] Open frontend to explore users
- [ ] Use filters to find interesting accounts
- [ ] Click users to view on Bluesky
- [ ] Deploy frontend to share dashboard

## Support

Check individual READMEs:
- Backend: Main directory
- Frontend: `frontend/README.md`
- Database: `supabase/README.md`
