# Bluesky Growth Engine

Growth engine for `neoreactionary.bsky.social` built on the AT Protocol.

## Setup

1. Copy `.env.example` to `.env` and fill in credentials.
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Run: `npm start`

## Development

- Watch mode: `npm run dev`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`

## Notes

The initial version logs in and posts a heartbeat. Add strategies in `src/strategies.ts` and orchestrate them in `src/index.ts`.
