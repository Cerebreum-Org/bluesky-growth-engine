import 'dotenv/config';
import { BskyAgent } from '@atproto/api';
import { Firehose } from '@atproto/sync';
import { supabase, type BlueskyUser } from './supabase.js';

/**
 * Firehose Collector - Captures ALL Bluesky users in real-time
 * 
 * This connects to Bluesky's firehose to capture every user as they:
 * - Create posts
 * - Update profiles
 * - Interact with the network
 * 
 * Run this 24/7 to build a complete database of ALL Bluesky users.
 */

const BATCH_SIZE = 100;
const PROFILE_FETCH_INTERVAL = 60000; // Fetch profiles every minute
const RELAY_URL = 'wss://bsky.network'; // Bluesky's public relay

let agent: BskyAgent;
const discoveredDids = new Set<string>();
const pendingProfiles = new Set<string>();
const userBatch: BlueskyUser[] = [];
let totalDiscovered = 0;
let totalSaved = 0;

async function initAgent() {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_PASSWORD;
  const service = process.env.BLUESKY_SERVICE || 'https://bsky.social';

  if (!handle || !password) {
    throw new Error('Missing BLUESKY_HANDLE or BLUESKY_PASSWORD');
  }

  agent = new BskyAgent({ service });
  await agent.login({ identifier: handle, password });
  console.log('✓ Authenticated as', handle);
}

async function flushUserBatch() {
  if (userBatch.length === 0) return;

  try {
    const batch = [...userBatch];
    userBatch.length = 0;

    const { error } = await supabase
      .from('bluesky_users')
      .upsert(batch, { onConflict: 'did' });

    if (error) throw error;
    totalSaved += batch.length;
    console.log(`✓ Saved batch of ${batch.length} users (Total: ${totalSaved.toLocaleString()})`);
  } catch (e) {
    console.warn('Failed to save user batch:', e);
  }
}

async function fetchAndSaveProfile(did: string) {
  if (discoveredDids.has(did)) return;
  discoveredDids.add(did);

  try {
    const profile = await agent.getProfile({ actor: did });
    const data = profile.data;

    const user: BlueskyUser = {
      did: data.did,
      handle: data.handle,
      display_name: data.displayName,
      description: data.description,
      avatar: data.avatar,
      banner: data.banner,
      followers_count: data.followersCount,
      following_count: data.followsCount,
      posts_count: data.postsCount,
      labels: data.labels as any,
      associated: data.associated as any,
      viewer_muted: data.viewer?.muted,
      viewer_blocked_by: data.viewer?.blockedBy,
      viewer_blocking: !!data.viewer?.blocking,
      viewer_following: !!data.viewer?.following,
      viewer_followed_by: !!data.viewer?.followedBy,
      created_at: data.createdAt,
      indexed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    userBatch.push(user);

    if (userBatch.length >= BATCH_SIZE) {
      await flushUserBatch();
    }
  } catch (e) {
    // User might not exist or be accessible
    // console.warn(`Failed to fetch profile for ${did}`);
  }
}

async function processProfileQueue() {
  const didsToProcess = Array.from(pendingProfiles).slice(0, 25); // Process 25 at a time
  pendingProfiles.clear();

  for (const did of didsToProcess) {
    await fetchAndSaveProfile(did);
    await new Promise(resolve => setTimeout(resolve, 50)); // Rate limiting
  }
}

async function startFirehose() {
  console.log('\n🔥 Starting Firehose Collector...');
  console.log('Connecting to:', RELAY_URL);
  console.log('This will capture ALL Bluesky users in real-time.\n');

  const firehose = new Firehose({
    service: RELAY_URL,
    onError: (err) => {
      console.error('Firehose error:', err);
    },
    handleEvent: async (evt) => {
      // Extract DIDs from all events
      if ('did' in evt) {
        const did = (evt as any).did;
        if (did && typeof did === 'string' && did.startsWith('did:')) {
          if (!discoveredDids.has(did)) {
            totalDiscovered++;
            pendingProfiles.add(did);

            if (totalDiscovered % 100 === 0) {
              console.log(`📊 Discovered: ${totalDiscovered.toLocaleString()} users, Saved: ${totalSaved.toLocaleString()}, Queue: ${pendingProfiles.size}`);
            }
          }
        }
      }

      // Also check for DIDs in commit records
      if ('commit' in evt && evt.commit) {
        const commit = evt.commit as any;
        if (commit.author && typeof commit.author === 'string') {
          const did = commit.author;
          if (did.startsWith('did:') && !discoveredDids.has(did)) {
            totalDiscovered++;
            pendingProfiles.add(did);
          }
        }
      }
    },
  });

  // Process profile queue periodically
  setInterval(async () => {
    if (pendingProfiles.size > 0) {
      await processProfileQueue();
    }
  }, PROFILE_FETCH_INTERVAL);

  // Flush remaining batches periodically
  setInterval(async () => {
    await flushUserBatch();
  }, 30000); // Every 30 seconds

  // Start the firehose
  firehose.start();

  console.log('✓ Firehose connected! Collecting users...\n');
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   BLUESKY COMPLETE NETWORK COLLECTOR (FIREHOSE)        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  await initAgent();

  // Load existing DIDs to avoid duplicates
  console.log('Loading existing users from database...');
  try {
    let offset = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('bluesky_users')
        .select('did')
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      data.forEach(u => discoveredDids.add(u.did));
      offset += batchSize;
    }
    console.log(`✓ Loaded ${discoveredDids.size.toLocaleString()} existing users\n`);
  } catch (e) {
    console.warn('Could not load existing users:', e);
  }

  await startFirehose();

  // Keep alive
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    await flushUserBatch();
    console.log(`\n✓ Final stats:`);
    console.log(`  - Discovered: ${totalDiscovered.toLocaleString()} users`);
    console.log(`  - Saved: ${totalSaved.toLocaleString()} users`);
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
