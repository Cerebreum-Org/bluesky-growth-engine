# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Bluesky growth automation bot for `neoreactionary.bsky.social` built on the AT Protocol SDK (`@atproto/api`). The engine collects Bluesky user data into a Supabase database and executes growth strategies like following back followers and liking mentions.

## Setup & Development Commands

```bash
# Initial setup
cp .env.example .env  # Fill in BLUESKY_HANDLE, BLUESKY_PASSWORD, BLUESKY_SERVICE
npm install

# Development
npm run dev        # Watch mode with tsx
npm run build      # Compile TypeScript to dist/
npm start          # Run compiled code from dist/
npm run lint       # ESLint with TypeScript rules
npm run typecheck  # Type checking without emitting
```

## Architecture

### Core Files

- **`src/index.ts`**: Entry point. Handles authentication and runs the user collection strategy.
- **`src/agent.ts`**: Creates and authenticates `BskyAgent` instances. Reusable helper for agent setup.
- **`src/strategies.ts`**: Growth strategies as async functions taking `BskyAgent`. Includes `collectUsers()` for crawling and storing user data, plus `followBack()` and `likeRecentMentions()`.
- **`src/supabase.ts`**: Supabase client setup and TypeScript interfaces for the database schema.

### Data Flow

1. Load credentials from environment → 2. Create authenticated `BskyAgent` → 3. Fetch users from Bluesky (followers/following) → 4. Store user data in Supabase with upsert logic

### User Collection Strategy

The `collectUsers()` strategy crawls Bluesky's social graph starting from your account:
- Fetches your profile, followers, and following
- Stores each unique user in Supabase (deduplicates by DID)
- Supports pagination to handle large networks
- Configurable max users, can include/exclude followers or following

### Key Dependencies

- **`@atproto/api`**: Bluesky AT Protocol client. Core methods: `login()`, `getProfile()`, `getFollowers()`, `getFollows()`, `follow()`, `like()`
- **`@supabase/supabase-js`**: Supabase client for PostgreSQL database operations
- **`dotenv`**: Environment config (credentials should never be committed)

## Development Guidelines

### Adding New Strategies

1. Create a new `async` function in `src/strategies.ts` that accepts `BskyAgent` and any parameters
2. Follow the pattern: fetch data → filter/process → execute actions with try/catch per action
3. Import and call from `src/index.ts` with error handling

### TypeScript Configuration

- Target: ES2022 with strict mode enabled
- Module: ES2022 (use `import`/`export`, not `require`)
- Output: `dist/` directory (gitignored)
- Strict type checking is enforced—avoid `any` types

### Environment Variables

Required in `.env`:
- `BLUESKY_HANDLE`: Bot account handle
- `BLUESKY_PASSWORD`: Bot account app password
- `BLUESKY_SERVICE`: AT Protocol service URL (defaults to `https://bsky.social`)
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase anon/public key

### Database Setup

See `supabase/README.md` for setup instructions. Run `supabase/schema.sql` in your Supabase SQL Editor to create the `bluesky_users` table with proper indexes and triggers.

### Error Handling

- Top-level errors in `main()` exit with code 1
- Per-action errors in strategies are caught, logged, and continue execution
- Always log action results for debugging (e.g., "Followed @handle")

## Database Rules

### Source of Truth Database

**CRITICAL:** The **only** database to use for this project is the `supabase-db` Docker container.

- **Container Name:** `supabase-db`
- **Access:** Via `supabase-kong` on port 8000 or direct container access
- **Data:** Contains 3.4M+ bluesky users in production tables
- **Studio Access:** `http://100.69.129.86:3001` (via Tailscale)

**Do NOT use:**
- Any `supabase_*_bluesky-growth-engine` containers (removed)
- Local dev databases on different ports
- Any other PostgreSQL instances

When working with the database:
1. Always verify you're connected to `supabase-db`
2. Check table names match the production schema (e.g., `public.bluesky_users`)
3. Use the Supabase client configured with `SUPABASE_URL=http://100.69.129.86:8000`


## Code Organization (Updated 2025-10-22)

- Moved 22 old script iterations to src/archive/
- Use git branches/commits for future changes, not new files
- See GIT_WORKFLOW.md for guidelines
CRITICAL: Warp Terminal Heredoc Bug - Never use heredoc syntax (cat << EOF or similar) as it causes Warp to hang. Instead use: echo commands, printf, or write to temp file then copy. Alternative: use Python/Node to write multi-line files.
