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
  console.log('Starting social graph collection from bsky.app...\n');

  // Configuration for crawling bsky.app network
  const seedHandles = ['bsky.app']; // Start from the official Bluesky account
  const maxUsers = Number(process.env.MAX_USERS || Number.POSITIVE_INFINITY);
  const maxDegrees = Number(process.env.MAX_DEGREES || 10); // Crawl deeply
  const rateLimitDelay = Number(process.env.RATE_LIMIT_DELAY_MS || 50);

  console.log(`Configuration:`);
  console.log(`- Seed: bsky.app`);
  console.log(`- Max Users: ${maxUsers === Number.POSITIVE_INFINITY ? 'UNLIMITED' : maxUsers.toLocaleString()}`);
  console.log(`- Max Degrees: ${maxDegrees} (deeply connected networks)`);
  console.log(`- Rate Limit: ${rateLimitDelay}ms\n`);
  console.log('This will collect:');
  console.log('  1. All followers & following of bsky.app');
  console.log('  2. All followers & following of those accounts');
  console.log('  3. Continue recursively up to degree', maxDegrees);
  console.log('  4. Store all relationships in the database\n');

  await collectUsersEnhanced(agent, {
    seedHandles,
    maxUsers,
    maxDegrees,
    includeFollowers: true,
    includeFollowing: true,
    rateLimitDelay,
  });

  console.log('\n✅ Social graph collection complete!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
