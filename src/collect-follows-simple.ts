import 'dotenv/config';
import { BskyAgent } from '@atproto/api';
import { supabase } from './supabase';

/**
 * Simplified collector - checks database for each user dynamically
 * No initial index build required
 */

const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? '50');
const RATE_LIMIT_DELAY = Number(process.env.RATE_LIMIT_DELAY_MS ?? '100');
const CONCURRENCY = Number(process.env.COLLECTOR_CONCURRENCY ?? '3');
const MAX_FOLLOWS_PER_USER = Number(process.env.MAX_FOLLOWS_PER_USER ?? '5000');

let agent: BskyAgent;
let totalFollows = 0;
let processedUsers = 0;

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

async function userExists(did: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('bluesky_users')
    .select('did')
    .eq('did', did)
    .limit(1)
    .maybeSingle();
  
  return !error && !!data;
}

async function collectUserFollows(did: string) {
  const followBatch: any[] = [];
  
  try {
    // Collect follows
    let cursor: string | undefined;
    let count = 0;

    do {
      const response = await agent.getFollows({ actor: did, limit: 100, cursor });
      
      for (const follow of response.data.follows) {
        followBatch.push({
          follower_did: did,
          following_did: follow.did,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        count++;
        if (count >= MAX_FOLLOWS_PER_USER) break;
      }

      if (followBatch.length >= BATCH_SIZE) {
        await supabase.from('bluesky_follows').upsert(followBatch, { onConflict: 'follower_did,following_did' });
        totalFollows += followBatch.length;
        followBatch.length = 0;
      }

      cursor = response.data.cursor;
      if (count >= MAX_FOLLOWS_PER_USER) break;
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    } while (cursor);

    // Save remaining
    if (followBatch.length > 0) {
      await supabase.from('bluesky_follows').upsert(followBatch, { onConflict: 'follower_did,following_did' });
      totalFollows += followBatch.length;
    }

    processedUsers++;
    if (processedUsers % 10 === 0) {
      console.log(`Processed: ${processedUsers} users | Follows: ${totalFollows}`);
    }
  } catch (e) {
    console.warn(`Failed to collect follows for ${did}:`, e);
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   SIMPLE FOLLOWS COLLECTOR            ║');
  console.log('╚═══════════════════════════════════════╝\n');

  await initAgent();
  
  console.log('Starting collection (no index build)...\n');

  let offset = 0;
  const batchSize = 50;
  
  while (true) {
    const { data, error } = await supabase
      .from('bluesky_users')
      .select('did, handle')
      .range(offset, offset + batchSize - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    for (const user of data) {
      await collectUserFollows(user.did);
    }
    
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  console.log(`\n✓ Complete! ${processedUsers} users, ${totalFollows} follows`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
