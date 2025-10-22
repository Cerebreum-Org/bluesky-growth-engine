# Available Scripts for Bluesky Growth Engine

All scripts connect to the production `supabase-db` database via port 8000.

## 🔥 Real-Time Collection

### `npm run collector:ultimate`
**File:** `src/jetstream-ultimate-collector.ts`
**Purpose:** Real-time collection from Bluesky Jetstream firehose
**What it does:**
- Connects to Bluesky's real-time event stream
- Collects posts, likes, reposts, follows, blocks, lists, and more
- Batches writes to database every 5 seconds or 500 events
- Handles 11 different collection types
- Failed insertions go to `bluesky_dead_letters` table
**Database tables used:** All 24 bluesky tables
**When to run:** Keep running 24/7 to collect live data
**Status:** ✅ Fully configured

---

## 📊 Backfill Scripts

### `npm run backfill:graph`
**File:** `src/backfill-social-graph.ts`
**Purpose:** Backfill historical user data from Bluesky API
**What it does:**
- Fetches user profiles, followers, and following lists
- Collects likes and reposts for posts
- Useful for catching up on historical data
**Database tables used:** `bluesky_users`
**When to run:** One-time or when you need to fill gaps in user data
**Status:** ✅ Fully configured

### `npm run backfill:enrichment`
**File:** `src/backfill-enrichment-from-posts.ts`
**Purpose:** Enrich existing post data with additional metadata
**What it does:**
- Processes existing posts to extract more information
- Adds hashtags, mentions, links, media from posts
**Database tables used:** TBD (needs verification)
**When to run:** After collecting posts, to add enrichment data
**Status:** ⚠️ Needs verification

---

## 📈 Analytics & Reports

### `npm run analytics`
**File:** `src/analytics.ts`
**Purpose:** Generate analytics and insights from collected data
**What it does:**
- Analyzes user growth patterns
- Engagement metrics
- Network analysis
**Database tables used:** Multiple (reads from various tables)
**When to run:** On-demand when you need reports
**Status:** ✅ Available

### `npm run check:progress`
**File:** `src/check-progress.ts`
**Purpose:** Check collection progress and statistics
**What it does:**
- Shows how many records collected
- Collection rate statistics
- Database health check
**When to run:** Anytime to monitor progress
**Status:** ✅ Available

---

## 🔧 Utility Scripts

### `npm run test:supabase`
**File:** `test-supabase.ts`
**Purpose:** Test Supabase database connection
**What it does:**
- Verifies connection to `supabase-db`
- Tests read/write permissions
**When to run:** When troubleshooting database issues
**Status:** ✅ Available

### `npm run db:migrate`
**File:** `run-migration.ts`
**Purpose:** Run database migrations
**What it does:**
- Applies SQL migration files to database
**When to run:** When new schema changes are needed
**Status:** ✅ Available

---

## 🎨 Frontend

### `npm run frontend`
**Purpose:** Start the Next.js frontend dev server
**What it does:**
- Runs dashboard UI at http://localhost:3002
- Shows collection progress, analytics
**When to run:** When you want to view the dashboard
**Status:** ✅ Running (accessible via Tailscale at http://100.69.129.86:3002)

---

## 🚫 Deprecated/Legacy Scripts

These scripts exist but may not be actively maintained:

- `npm run dev` - Old development watch mode
- `npm run collect:all` - Legacy collection script
- `npm run collect:interactions` - Replaced by jetstream collector
- `npm run collect:follows*` - Various follow collection scripts
- `npm run firehose` - Old firehose collector

**Recommendation:** Use `collector:ultimate` instead of legacy collectors.

---

## 📋 Typical Workflow

### Initial Setup
1. `npm run test:supabase` - Verify database connection
2. `npm run backfill:graph` - Backfill historical user data (optional)

### Continuous Operation
1. `npm run collector:ultimate` - Run 24/7 for real-time collection
2. `npm run frontend` - View dashboard (optional)
3. `npm run check:progress` - Check stats periodically
4. `npm run analytics` - Generate reports as needed

### Maintenance
- Monitor `bluesky_dead_letters` table for failed insertions
- Use Studio UI at http://100.69.129.86:3001 for SQL queries
- Check logs for errors

---

## 🗄️ Database Configuration

All scripts use environment variables from `.env`:
- `SUPABASE_URL=http://100.69.129.86:8000` - Production database
- `SUPABASE_KEY=<your-key>` - Authentication key

**Important:** Do NOT change SUPABASE_URL - all 3.4M users are in this database!

See `WARP.md` and `supabase/MIGRATIONS_APPLIED.md` for more details.
