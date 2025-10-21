# Technical Guide

This document codifies technical standards and patterns for Bluesky Growth Engine.

## Stack
- Runtime: Node.js + TypeScript (ES2022 modules)
- Core libs: @atproto/api, @supabase/supabase-js, ws, express
- Outputs: dist/ (compiled TS)

## Module Boundaries
- Core Engine (`src/`): collectors, strategies, API server, Supabase client
- Frontend UIs (`frontend/`, `frontend-nextjs/`): optional UIs; communicate via REST API in `src/api-server.ts`
- Database (`supabase/`): SQL schema and migrations

## Coding Standards
- TypeScript strict=true; avoid `any`
- Public functions: JSDoc for parameters/returns
- Files ≤ 300 lines where practical; split by responsibility
- Prefer pure functions; isolate side effects (network, DB)

## Error Handling & Logging
- Top-level errors exit(1)
- Strategy actions: catch/log and continue
- Use structured logs (prefix with context: module, user, id)

## Patterns
- Strategies live in `src/strategies.ts` (to be split into smaller modules)
- Supabase client in `src/supabase.ts` with typed interfaces
- Long-running collectors support pagination, rate limits, and retries

## Environment Variables
Required (backend):
- BLUESKY_HANDLE, BLUESKY_PASSWORD, BLUESKY_SERVICE (default https://bsky.social)
- SUPABASE_URL, SUPABASE_KEY (service role for backend)
Optional:
- API_HOST, API_PORT (for `src/api-server.ts`)
- PROXY_LIST (for proxy-enabled collectors)
- Tuning: BATCH_SIZE, RATE_LIMIT_DELAY_MS, CONCURRENCY, etc.
Frontend (public): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

## Testing (baseline)
- Root: add Vitest later; CI to run `npm run lint` and `npm run typecheck`
- Frontend: uses Vitest/Playwright in `frontend/`

## Lint/Typecheck
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`

## Security
- No secrets committed; use env vars
- Backend should use service role key; frontend must use anon key only
- RLS enforced in Supabase; separate dev/prod envs
