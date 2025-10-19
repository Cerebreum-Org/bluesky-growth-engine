import 'dotenv/config';
import { BskyAgent } from '@atproto/api';
import { collectUsersEnhanced } from './strategies.js';

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
  console.log('Starting MAXIMUM COVERAGE collection...\n');

  // Popular seed accounts across different communities to maximize reach
  const seedHandles = [
    'pfrazee.com', // Paul Frazee (Bluesky co-founder)
    'bsky.app', // Official Bluesky
    'jay.bsky.team', // Jay Graber (CEO)
    'bnewbold.net', // Bryan Newbold (protocol lead)
    'dril.bsky.social', // Popular accounts
    'aoc.bsky.social',
    'mkbhd.bsky.social',
    'tonyrobbins.bsky.social',
    'stephenfry.bsky.social',
    'neil-gaiman.bsky.social',
    // Add more popular accounts from different niches
  ];

  const maxUsers = Number(process.env.MAX_USERS || Number.POSITIVE_INFINITY);
  const maxDegrees = Number(process.env.MAX_DEGREES || 6);
  // Bluesky API limit: 3000 req/5min = 10 req/sec max. 150ms = 6.67 req/sec (safe margin)
  const rateLimitDelay = Number(process.env.RATE_LIMIT_DELAY_MS || 150);

  console.log(`Configuration:`);
  console.log(`- Max Users: ${maxUsers === Number.POSITIVE_INFINITY ? 'UNLIMITED' : maxUsers.toLocaleString()}`);
  console.log(`- Max Degrees: ${maxDegrees}`);
  console.log(`- Seeds: ${seedHandles.length} popular accounts`);
  console.log(`- Rate Limit: ${rateLimitDelay}ms\n`);

  // Crawl from multiple seeds to maximize coverage
  await collectUsersEnhanced(agent, {
    seedHandles,
    maxUsers,
    maxDegrees,
    includeFollowers: true,
    includeFollowing: true,
    rateLimitDelay,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
