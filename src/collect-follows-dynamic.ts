import 'dotenv/config';
import { BskyAgent } from '@atproto/api';
import { supabase } from './supabase';

/**
 * Dynamic Social Graph Collector with User Discovery
 * 
 * Expands the network by discovering and adding new users as we find them.
 * When a follow relationship references an unknown user, we:
 * 1. Fetch their profile from Bluesky
 * 2. Add them to the database
 * 3. Save the follow relationship
 * 
 * This creates a "snowball sample" that expands outward from your seed users.
 */

const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? '25'); // Reduced from 50
const RATE_LIMIT_DELAY = Number(process.env.RATE_LIMIT_DELAY_MS ?? '100'); // ms between requests
const CONCURRENCY = Number(process.env.COLLECTOR_CONCURRENCY ?? '2'); // Reduced from 3
const MAX_FOLLOWS_PER_USER = Number(process.env.MAX_FOLLOWS_PER_USER ?? '5000'); // Limit to avoid huge queries
const USER_FETCH_BATCH_SIZE = Number(process.env.USER_FETCH_BATCH_SIZE ?? '10'); // Batch profile fetches
const MAX_DB_RETRIES = Number(process.env.MAX_DB_RETRIES ?? '3');
const MAX_RPS = Number(process.env.BSKY_MAX_RPS ?? '8'); // Conservative vs ~10 RPS quota
const MAX_RETRIES = Number(process.env.RETRY_MAX_ATTEMPTS ?? '5');

// Simple global rate limiter + retry/backoff around Bluesky API calls
const requestTimestamps: number[] = [];
let globalResumeAfter = 0;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function beforeRequest() {
  // Honor global pause (e.g., after 429 with reset header)
  const now = Date.now();
  if (now < globalResumeAfter) {
    await sleep(globalResumeAfter - now + 50);
  }
  // Enforce MAX_RPS within 1-second window
  while (true) {
    const t = Date.now();
    // keep only timestamps within last 1000ms
    while (requestTimestamps.length && t - requestTimestamps[0] >= 1000) {
      requestTimestamps.shift();
    }
    if (requestTimestamps.length < MAX_RPS) {
      requestTimestamps.push(t);
      return;
    }
    const waitMs = 1000 - (t - requestTimestamps[0]);
    await sleep(Math.max(5, waitMs));
  }
}

async function requestWithRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  for (;;) {
    await beforeRequest();
    try {
      const res: any = await fn();
      // Adapt to headers if provided
      const headers = res?.headers;
      if (headers) {
        const remaining = Number(headers['ratelimit-remaining'] ?? headers['x-ratelimit-remaining']);
        const reset = headers['ratelimit-reset'] ?? headers['x-ratelimit-reset'];
        if (!Number.isNaN(remaining) && remaining <= 1 && reset) {
          const resetAt = Number(reset) * 1000;
          if (!Number.isNaN(resetAt)) {
            globalResumeAfter = Math.max(globalResumeAfter, resetAt);
          }
        }
      }
      return res as T;
    } catch (e: any) {
      const status = e?.status ?? e?.response?.status;
      const headers = e?.headers ?? e?.response?.headers;
      if (status === 429) {
        const reset = headers?.['ratelimit-reset'] ?? headers?.['x-ratelimit-reset'];
        let waitMs = 30_000;
        if (reset) {
          const resetAt = Number(reset) * 1000;
          if (!Number.isNaN(resetAt)) {
            waitMs = Math.max(1000, resetAt - Date.now());
            globalResumeAfter = Math.max(globalResumeAfter, Date.now() + waitMs);
          }
        }
        await sleep(waitMs + Math.floor(Math.random() * 500));
        continue;
      }
      if (status && status >= 500 && status < 600 && attempt < MAX_RETRIES) {
        const backoff = Math.min(60_000, Math.pow(2, attempt) * 1000) + Math.floor(Math.random() * 250);
        attempt++;
        await sleep(backoff);
        continue;
      }
      throw e;
    }
  }
}

let agent: BskyAgent;
let totalUsers = 0;
let processedUsers = 0;
let totalFollows = 0;
let discoveredUsers = 0;
let startTime = Date.now();

// In-memory caches
const knownUserDids = new Set<string>();
const discoveredUserDids = new Set<string>(); // New users found during collection
const pendingUserProfiles: string[] = []; // Queue of DIDs to fetch profiles for

const followBatch: Array<{
  follower_did: string;
  following_did: string;
  created_at: string;
  updated_at: string;
}> = [];

const userBatch: Array<{
  did: string;
  handle: string;
  display_name?: string;
  description?: string;
  avatar?: string;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
  indexed_at: string;
  generation?: number; // How many degrees from seed users (optional - may not exist in DB yet)
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

async function flushFollowBatch() {
  if (followBatch.length === 0) return;

  const uniqueFollows = new Map();
  followBatch.forEach(follow => {
    const key = `${follow.follower_did}:${follow.following_did}`;
    uniqueFollows.set(key, follow);
  });
  const batch = Array.from(uniqueFollows.values());
  followBatch.length = 0;

  // Retry logic with exponential backoff
  for (let attempt = 0; attempt < MAX_DB_RETRIES; attempt++) {
    try {
      const { error } = await supabase
        .from('bluesky_follows')
        .upsert(batch, { onConflict: 'follower_did,following_did' });

      if (error) throw error;
      totalFollows += batch.length;
      return; // Success
    } catch (e: any) {
      const isTimeout = e?.code === '57014' || e?.message?.includes('timeout');
      const isForeignKey = e?.code === '23503';
      
      if (isForeignKey) {
        // Foreign key violation - users not inserted yet, skip this batch
        console.warn('Foreign key violation - skipping follow batch (users not inserted yet)');
        return;
      }
      
      if (attempt === MAX_DB_RETRIES - 1) {
        console.warn('Failed to save follow batch after retries:', e);
        return;
      }
      
      if (isTimeout) {
        // Wait longer before retry on timeout
        await sleep(Math.pow(2, attempt) * 2000);
      } else {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }
}

async function flushUserBatch() {
  if (userBatch.length === 0) return;

  const batch = [...userBatch];
  userBatch.length = 0;

  // Retry logic with exponential backoff
  for (let attempt = 0; attempt < MAX_DB_RETRIES; attempt++) {
    try {
      const { error } = await supabase
        .from('bluesky_users')
        .upsert(batch, { onConflict: 'did' });

      if (error) throw error;
      discoveredUsers += batch.length;
      
      // Add to known users set
      batch.forEach(u => knownUserDids.add(u.did));
      return; // Success
    } catch (e: any) {
      const isTimeout = e?.code === '57014' || e?.message?.includes('timeout');
      
      if (attempt === MAX_DB_RETRIES - 1) {
        console.warn('Failed to save user batch after retries:', e);
        // Still add to known set to prevent duplicates
        batch.forEach(u => knownUserDids.add(u.did));
        return;
      }
      
      if (isTimeout) {
        // Wait longer before retry on timeout
        await sleep(Math.pow(2, attempt) * 2000);
      } else {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }
}

async function fetchUserProfiles(dids: string[], generation: number) {
  if (dids.length === 0) return;

  try {
    // Fetch profiles sequentially under global rate limit
    const profiles: Array<any | null> = [];
    for (const did of dids) {
      try {
        const response: any = await requestWithRateLimit(() => agent.getProfile({ actor: did }));
        const profile = response.data;
        profiles.push({
          did: profile.did,
          handle: profile.handle,
          display_name: profile.displayName,
          description: profile.description,
          avatar: profile.avatar,
          followers_count: profile.followersCount,
          following_count: profile.followsCount,
          posts_count: profile.postsCount,
          indexed_at: new Date().toISOString(),
          // generation: generation, // Omitted - will be added via migration later
        });
      } catch (e) {
        console.warn(`Failed to fetch profile for ${did}:`, e);
      }
    }

    // Add valid profiles to batch
    profiles.forEach(profile => {
      if (profile) {
        userBatch.push(profile);
      }
    });

    // Flush if batch is full
    if (userBatch.length >= BATCH_SIZE) {
      await flushUserBatch();
    }
  } catch (e) {
    console.warn('Error fetching user profiles:', e);
  }
}

async function processPendingUsers(generation: number) {
  if (pendingUserProfiles.length === 0) return;

  const batch = pendingUserProfiles.splice(0, USER_FETCH_BATCH_SIZE);
  await fetchUserProfiles(batch, generation);
  
  // Small delay to avoid rate limits
  await new Promise(resolve => setTimeout(resolve, 100));
}

async function collectUserFollows(did: string, generation: number) {
  try {
    // Get following (who this user follows)
    let cursor: string | undefined;
    let count = 0;

    do {
      const response = await requestWithRateLimit(() => agent.getFollows({
        actor: did,
        limit: 100,
        cursor,
      }));

      for (const follow of response.data.follows) {
        // Check if user is known
        if (!knownUserDids.has(follow.did) && !discoveredUserDids.has(follow.did)) {
          // New user discovered! Queue for profile fetch
          discoveredUserDids.add(follow.did);
          pendingUserProfiles.push(follow.did);
          
          // Process pending users periodically
          if (pendingUserProfiles.length >= USER_FETCH_BATCH_SIZE) {
            await processPendingUsers(generation + 1);
            // Flush users BEFORE adding follow relationships
            await flushUserBatch();
          }
        }

        // Always save the follow relationship
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
        // Ensure users are flushed before follows
        await flushUserBatch();
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
      const response = await requestWithRateLimit(() => agent.getFollowers({
        actor: did,
        limit: 100,
        cursor,
      }));

      for (const follower of response.data.followers) {
        // Check if user is known
        if (!knownUserDids.has(follower.did) && !discoveredUserDids.has(follower.did)) {
          // New user discovered!
          discoveredUserDids.add(follower.did);
          pendingUserProfiles.push(follower.did);
          
          if (pendingUserProfiles.length >= USER_FETCH_BATCH_SIZE) {
            await processPendingUsers(generation + 1);
            // Flush users BEFORE adding follow relationships
            await flushUserBatch();
          }
        }

        // Always save the follow relationship
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
        // Ensure users are flushed before follows
        await flushUserBatch();
        await flushFollowBatch();
      }

      cursor = response.data.cursor;
      if (count >= MAX_FOLLOWS_PER_USER) break;
      
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    } while (cursor);

  } catch (e) {
    console.warn(`Failed to collect follows for ${did}:`, e);
  }
}

async function processUser(did: string, handle: string, generation: number) {
  try {
    await collectUserFollows(did, generation);
    
    // Process any remaining pending users
    if (pendingUserProfiles.length > 0) {
      await processPendingUsers(generation + 1);
    }
    
    processedUsers++;
    
    if (processedUsers % 50 === 0) {
      const pct = ((processedUsers / totalUsers) * 100).toFixed(1);
      const rate = Math.round(processedUsers / ((Date.now() - startTime) / 1000 / 60));
      const remaining = totalUsers > processedUsers ? Math.round((totalUsers - processedUsers) / rate) : 0;
      console.log(`Progress: ${processedUsers.toLocaleString()}/${totalUsers.toLocaleString()} (${pct}%) | Follows: ${totalFollows.toLocaleString()} | Discovered: ${discoveredUsers.toLocaleString()} users | Rate: ${rate}/min | ETA: ${remaining}min`);
    }
  } catch (e) {
    console.warn(`Failed to process user ${handle}:`, e);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║    DYNAMIC SOCIAL GRAPH COLLECTOR (WITH DISCOVERY)    ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  await initAgent();

  // Build initial user DID index (these are "generation 0" seed users)
  console.log('Building user DID index from existing database...');
  let lastDid: string | null = null;
  const pageSize = 1000; // Reduced from 5000 to avoid timeouts
  let indexedCount = 0;
  
  while (true) {
    try {
      // Use keyset pagination (more efficient than offset/range)
      const query = supabase
        .from('bluesky_users')
        .select('did')
        .order('did', { ascending: true })
        .limit(pageSize);
      
      if (lastDid) {
        query.gt('did', lastDid);
      }
      
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching DIDs:', error);
        if (error.message?.includes('timeout')) {
          console.log('Query timeout - trying smaller batch...');
          // Continue with what we have
          break;
        }
        throw error;
      }
      
      if (!data || data.length === 0) break;

      data.forEach(u => knownUserDids.add(u.did));
      indexedCount += data.length;
      lastDid = data[data.length - 1].did;
      
      if (indexedCount % 50000 === 0) {
        console.log(`  Indexed ${indexedCount.toLocaleString()} user DIDs...`);
      }
      
      if (data.length < pageSize) break;
    } catch (e: any) {
      console.error('Failed to build user index:', e);
      if (indexedCount === 0) {
        throw new Error('Could not index any users - check database connection');
      }
      console.log(`Continuing with ${indexedCount} indexed users...`);
      break;
    }
  }
  
  totalUsers = knownUserDids.size;
  console.log(`✓ Indexed ${totalUsers.toLocaleString()} seed users (generation 0)\n`);

  console.log('Starting dynamic social graph collection...\n');
  console.log(`⚡ PARALLEL MODE: Processing ${CONCURRENCY} users concurrently`);
  console.log(`🔍 DISCOVERY MODE: New users will be added as they are found`);
  console.log(`📊 Collecting: follows + discovering new users in the network\n`);

  startTime = Date.now();

  // Process users in parallel with streaming pagination
  const workers: Promise<void>[] = [];
  let currentOffset = 0;
  const batchSize = 50;
  
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(
      (async () => {
        while (true) {
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
            // Always use generation 0 for seed users (users already in DB)
            await processUser(user.did, user.handle, 0);
          }
          
          if (data.length < batchSize) break;
        }
      })()
    );
  }

  await Promise.all(workers);

  // Flush remaining batches
  console.log('\nFlushing remaining batches...');
  if (pendingUserProfiles.length > 0) {
    await processPendingUsers(999); // Flush remaining with high generation
  }
  await flushFollowBatch();
  await flushUserBatch();

  const endTime = Date.now();
  const durationHours = ((endTime - startTime) / 1000 / 60 / 60).toFixed(2);

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║              COLLECTION COMPLETE!                      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  console.log(`Statistics:`);
  console.log(`  - Seed users: ${totalUsers.toLocaleString()}`);
  console.log(`  - Users processed: ${processedUsers.toLocaleString()}`);
  console.log(`  - New users discovered: ${discoveredUsers.toLocaleString()}`);
  console.log(`  - Total users now: ${(totalUsers + discoveredUsers).toLocaleString()}`);
  console.log(`  - Follow relationships: ${totalFollows.toLocaleString()}`);
  console.log(`  - Duration: ${durationHours} hours\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
