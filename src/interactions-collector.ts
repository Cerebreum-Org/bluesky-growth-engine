import 'dotenv/config';
import { BskyAgent } from '@atproto/api';
import { collectFromPostInteractions } from './strategies.js';

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

  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   BLUESKY POST INTERACTIONS COLLECTOR                  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log('✓ Authenticated as', handle);

  // Configuration via environment variables
  const sourceHandle = process.env.SOURCE_HANDLE || handle;
  const maxUsers = Number(process.env.MAX_USERS || 5000);
  const postLimit = Number(process.env.POST_LIMIT || 50);
  const includeLikes = (process.env.INCLUDE_LIKES || 'true') === 'true';
  const includeReposts = (process.env.INCLUDE_REPOSTS || 'true') === 'true';
  const includeReplies = (process.env.INCLUDE_REPLIES || 'true') === 'true';
  const rateLimitDelay = Number(process.env.RATE_LIMIT_DELAY_MS || 100);

  console.log('\nConfiguration:');
  console.log(`  Source: @${sourceHandle}`);
  console.log(`  Max users: ${maxUsers.toLocaleString()}`);
  console.log(`  Posts to analyze: ${postLimit}`);
  console.log(`  Include likes: ${includeLikes}`);
  console.log(`  Include reposts: ${includeReposts}`);
  console.log(`  Include replies: ${includeReplies}`);

  // Collect users from post interactions
  await collectFromPostInteractions(agent, {
    maxUsers,
    sourceHandle: sourceHandle === handle ? undefined : sourceHandle,
    postLimit,
    includeLikes,
    includeReposts,
    includeReplies,
    rateLimitDelay,
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
