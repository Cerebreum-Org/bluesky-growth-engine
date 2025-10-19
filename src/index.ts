import 'dotenv/config';
import { initSentry, Sentry } from './sentry.js';
import { BskyAgent } from '@atproto/api';
import { collectUsersEnhanced } from './strategies.js';

// Initialize Sentry before anything else
initSentry();

async function main() {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_PASSWORD;
  const service = process.env.BLUESKY_SERVICE || 'https://bsky.social';

  if (!handle || !password) {
    console.error('Missing BLUESKY_HANDLE or BLUESKY_PASSWORD');
    process.exit(1);
  }

  const agent = new BskyAgent({ service });
  await agent.login({ identifier: handle, password });

  console.log('Logged in as', handle);

  // Optional configuration via environment variables
  const seedEnv = process.env.SEED_HANDLES || '';
  const seedHandles = seedEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const maxUsers = Number(process.env.MAX_USERS || 1000000); // 1 million default
  const maxDegrees = Number(process.env.MAX_DEGREES || 5); // More degrees for wider reach
  const includeFollowers = (process.env.INCLUDE_FOLLOWERS || 'true') === 'true';
  const includeFollowing = (process.env.INCLUDE_FOLLOWING || 'true') === 'true';
  const minFollowers = Number(process.env.MIN_FOLLOWERS || 0);
  const maxFollowers = Number(process.env.MAX_FOLLOWERS || Number.POSITIVE_INFINITY);
  const rateLimitDelay = Number(process.env.RATE_LIMIT_DELAY_MS || 50); // Reduced for faster collection

  // Enhanced crawl across multiple degrees
  await collectUsersEnhanced(agent, {
    seedHandles,
    maxUsers,
    maxDegrees,
    includeFollowers,
    includeFollowing,
    minFollowers,
    maxFollowers,
    rateLimitDelay,
  });
}

main().catch((err) => {
  console.error(err);
  Sentry.captureException(err);
  // Flush Sentry events before exit
  Sentry.close(2000).then(() => {
    process.exit(1);
  });
});
