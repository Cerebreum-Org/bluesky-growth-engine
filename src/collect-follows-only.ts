import 'dotenv/config';
import { BskyAgent } from '@atproto/api';
import { supabase } from './supabase.js';

/**
 * Fast Social Graph Collector - Follows Only
 * 
 * Collects follower/following relationships for all users.
 * Much faster than the full backfill since it skips posts/likes/reposts.
 */

const BATCH_SIZE = 10; // Further reduced for database stability
const RATE_LIMIT_DELAY = 30; // ms between requests
const DB_WRITE_DELAY_MIN = 50; // min ms delay after each database write
const DB_WRITE_DELAY_MAX = 100; // max ms delay after each database write
const CONCURRENCY = 5; // Reduced to prevent database overload
const MAX_FOLLOWS_PER_USER = 5000; // Limit to avoid huge queries
const MAX_RETRIES = 5; // Maximum retry attempts for failed operations
const BASE_RETRY_DELAY = 250; // Base delay for exponential backoff (ms)
const MAX_RETRY_DELAY = 5000; // Max delay cap (ms)

// Test mode: set TEST_MODE=true to process only first 200 users
const TEST_MODE = process.env.TEST_MODE === 'true';
const TEST_USER_LIMIT = 200;

let agent: BskyAgent;
let totalUsers = 0;
let processedUsers = 0;
let totalFollows = 0;
const userDids = new Set<string>();

const followBatch: Array<{
  follower_did: string;
  following_did: string;
  created_at: string;
  updated_at: string;
}> = [];

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

async function ensureUsersExist(dids: string[]) {
  if (dids.length === 0) return;

  try {
    // Check which DIDs don't exist in the database
    const { data: existing } = await supabase
      .from('bluesky_users')
      .select('did')
      .in('did', dids);

    const existingDids = new Set((existing || []).map(u => u.did));
    const missingDids = dids.filter(did => !existingDids.has(did));

    if (missingDids.length === 0) return;

    // Insert minimal user records for missing DIDs
    const now = new Date().toISOString();
    const minimalUsers = missingDids.map(did => ({
      did,
      handle: `${did.slice(-8)}.unknown`, // Temporary handle
      indexed_at: now,
      updated_at: now,
    }));

    const { error } = await supabase
      .from('bluesky_users')
      .insert(minimalUsers)
      .select('*')
      .then(result => {
        // Ignore duplicate key errors (user was added by another worker)
        if (result.error && result.error.code === '23505') {
          return { error: null };
        }
        return result;
      });

    if (error) {
      console.warn(`Failed to insert ${missingDids.length} missing users:`, error.message);
    } else {
      console.log(`  ✓ Auto-added ${missingDids.length} discovered users`);
    }
  } catch (e: any) {
    console.warn('Failed to ensure users exist:', e.message || e);
  }
}

async function flushFollowBatch() {
  if (followBatch.length === 0) return;

  const uniqueFollows = new Map();
  followBatch.forEach(follow => {
    const key = `${follow.follower_did}:${follow.following_did}`;
    uniqueFollows.set(key, follow);
  });
  const batch = Array.from(uniqueFollows.values());
  followBatch.length = 0;

  // Extract all unique DIDs from the batch
  const allDids = new Set<string>();
  batch.forEach(follow => {
    allDids.add(follow.follower_did);
    allDids.add(follow.following_did);
  });

  // Ensure all users exist before inserting follows
  await ensureUsersExist(Array.from(allDids));

  // Retry logic with exponential backoff
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Use INSERT with ON CONFLICT DO NOTHING for better performance
      const { error } = await supabase
        .from('bluesky_follows')
        .insert(batch)
        .select('*')
        .then(result => {
          // Ignore duplicate key errors (23505)
          if (result.error && result.error.code === '23505') {
            return { error: null };
          }
          return result;
        });

      if (error) throw error;
      totalFollows += batch.length;
      
      // Random delay between 50-100ms to reduce database load spikes
      const delay = DB_WRITE_DELAY_MIN + Math.random() * (DB_WRITE_DELAY_MAX - DB_WRITE_DELAY_MIN);
      await new Promise(resolve => setTimeout(resolve, delay));
      return; // Success, exit retry loop
    } catch (e: any) {
      if (attempt === MAX_RETRIES) {
        console.warn(`Failed to save follow batch after ${MAX_RETRIES} retries:`, e.message || e);
        return;
      }
      
      // Calculate backoff with jitter
      const backoff = Math.min(
        BASE_RETRY_DELAY * Math.pow(2, attempt) + Math.random() * 100,
        MAX_RETRY_DELAY
      );
      
      if (attempt > 0) {
        console.log(`  Retry ${attempt}/${MAX_RETRIES} after ${Math.round(backoff)}ms...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
}

async function collectUserFollows(did: string) {
  try {
    // Get following (who this user follows)
    let cursor: string | undefined;
    let count = 0;

    do {
      const response = await agent.getFollows({
        actor: did,
        limit: 100,
        cursor,
      });

      for (const follow of response.data.follows) {
        // Add all follows without filtering (let database handle duplicates)
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
        await flushFollowBatch();
      }

      cursor = response.data.cursor;
      if (count >= MAX_FOLLOWS_PER_USER) break;
      
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    } while (cursor);

    // Get followers (who follows this user)
    cursor = undefined;
    count = 0;

    do {
      const response = await agent.getFollowers({
        actor: did,
        limit: 100,
        cursor,
      });

      for (const follower of response.data.followers) {
        // Add all follows without filtering (let database handle duplicates)
        followBatch.push({
          follower_did: follower.did,
          following_did: did,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        count++;
        if (count >= MAX_FOLLOWS_PER_USER) break;
      }

      if (followBatch.length >= BATCH_SIZE) {
        await flushFollowBatch();
      }

      cursor = response.data.cursor;
      if (count >= MAX_FOLLOWS_PER_USER) break;
      
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    } while (cursor);

  } catch {
    // Skip on error
  }
}

async function processUser(did: string, handle: string) {
  try {
    await collectUserFollows(did);
    
    processedUsers++;
    
    if (processedUsers % 100 === 0) {
      const pct = ((processedUsers / totalUsers) * 100).toFixed(1);
      const rate = Math.round(processedUsers / ((Date.now() - startTime) / 1000 / 60));
      const remaining = Math.round((totalUsers - processedUsers) / rate);
      console.log(`Progress: ${processedUsers.toLocaleString()}/${totalUsers.toLocaleString()} (${pct}%) | Follows: ${totalFollows.toLocaleString()} | Rate: ${rate}/min | ETA: ${remaining}min`);
    }
  } catch (e) {
    console.warn(`Failed to process user ${handle}:`, e);
  }
}

let startTime = Date.now();

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║         FAST SOCIAL GRAPH COLLECTOR (FOLLOWS)         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  await initAgent();

  // Skip expensive count query - we'll track total dynamically
  totalUsers = TEST_MODE ? TEST_USER_LIMIT : 1000000; // Estimate for progress tracking

  if (TEST_MODE) {
    console.log('🧪 TEST MODE ENABLED - Processing only first 200 users\n');
  }

  console.log('Starting social graph collection...\n');
  console.log(`⚡ PARALLEL MODE: Processing ${CONCURRENCY} users concurrently`);
  console.log(`Collecting: ALL follower/following relationships`);
  console.log(`Auto-discovery: New users found in social graph will be added to database`);
  console.log(`Batch size: ${BATCH_SIZE} | Retries: ${MAX_RETRIES} with exponential backoff\n`);

  startTime = Date.now();

  // Process users in parallel with streaming pagination
  const workers: Promise<void>[] = [];
  let currentOffset = 0;
  const batchSize = 50;
  
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(
      (async () => {
        while (true) {
          // Check if we've reached the test limit
          if (TEST_MODE && processedUsers >= TEST_USER_LIMIT) {
            break;
          }
          
          const offset = currentOffset;
          currentOffset += batchSize;
          
          const { data, error } = await supabase
            .from('bluesky_users')
            .select('did, handle')
            .range(offset, offset + batchSize - 1);
          
          if (error) {
            console.warn(`Failed to fetch users at offset ${offset}:`, error);
            break;
          }
          if (!data || data.length === 0) break;
          
          for (const user of data) {
            if (TEST_MODE && processedUsers >= TEST_USER_LIMIT) {
              break;
            }
            await processUser(user.did, user.handle);
          }
          
          if (data.length < batchSize) break;
        }
      })()
    );
  }

  await Promise.all(workers);

  // Flush remaining batches
  console.log('\nFlushing remaining batches...');
  await flushFollowBatch();

  const endTime = Date.now();
  const durationHours = ((endTime - startTime) / 1000 / 60 / 60).toFixed(2);

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║              COLLECTION COMPLETE!                      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  console.log(`Statistics:`);
  console.log(`  - Users processed: ${processedUsers.toLocaleString()}`);
  console.log(`  - Follow relationships: ${totalFollows.toLocaleString()}`);
  console.log(`  - Duration: ${durationHours} hours\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
