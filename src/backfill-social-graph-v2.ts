import { BskyAgent } from '@atproto/api';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Bluesky API
  service: process.env.BLUESKY_SERVICE || 'https://bsky.social',
  handle: process.env.BLUESKY_HANDLE!,
  password: process.env.BLUESKY_PASSWORD!,
  
  // Database
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_KEY!,
  
  // Performance
  concurrency: parseInt(process.env.CONCURRENCY || '5'),
  batchSize: parseInt(process.env.BATCH_SIZE || '100'),
  rateLimitDelay: parseInt(process.env.RATE_LIMIT_DELAY || '100'),
  
  // Collection settings
  maxPostsPerUser: parseInt(process.env.MAX_POSTS_PER_USER || '100'),
  collectLikes: process.env.COLLECT_LIKES !== 'false',
  collectReposts: process.env.COLLECT_REPOSTS !== 'false',
  collectFollows: process.env.COLLECT_FOLLOWS !== 'false',
  
  // Checkpoint
  checkpointFile: path.join(process.cwd(), 'backfill-checkpoint.json'),
  checkpointInterval: 100, // Save progress every N users
};

// ============================================================================
// TYPES
// ============================================================================

interface Checkpoint {
  lastProcessedIndex: number;
  lastDid?: string; // for keyset pagination
  processedUsers: number;
  collectedPosts: number;
  collectedLikes: number;
  collectedReposts: number;
  collectedFollows: number;
  updatedAt: string;
}

interface UserBatch {
  did: string;
  handle: string;
  index: number;
}

// ============================================================================
// GLOBALS
// ============================================================================

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
let agent: BskyAgent;

const stats = {
  processedUsers: 0,
  totalPosts: 0,
  totalLikes: 0,
  totalReposts: 0,
  totalFollows: 0,
  errors: 0,
  startTime: Date.now(),
};

// Batches for efficient bulk inserts
const batches = {
  posts: [] as any[],
  likes: [] as any[],
  reposts: [] as any[],
  follows: [] as any[],
};

// ============================================================================
// AUTHENTICATION
// ============================================================================

async function initAgent(): Promise<void> {
  if (!CONFIG.handle || !CONFIG.password) {
    throw new Error('Missing BLUESKY_HANDLE or BLUESKY_PASSWORD environment variables');
  }
  
  agent = new BskyAgent({ service: CONFIG.service });
  await agent.login({ identifier: CONFIG.handle, password: CONFIG.password });
  console.log(`✓ Authenticated as ${CONFIG.handle}`);
}

// ============================================================================
// CHECKPOINT SYSTEM (File-based)
// ============================================================================

function loadCheckpoint(): Checkpoint | null {
  try {
    if (fs.existsSync(CONFIG.checkpointFile)) {
      const data = fs.readFileSync(CONFIG.checkpointFile, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading checkpoint:', error);
  }
  return null;
}

function saveCheckpoint(index: number): void {
  const checkpoint: Checkpoint = {
    lastProcessedIndex: index,
    lastDid: (global as any)._lastDid || undefined,
    processedUsers: stats.processedUsers,
    collectedPosts: stats.totalPosts,
    collectedLikes: stats.totalLikes,
    collectedReposts: stats.totalReposts,
    collectedFollows: stats.totalFollows,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CONFIG.checkpointFile, JSON.stringify(checkpoint, null, 2));
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function flushPosts(): Promise<void> {
  if (batches.posts.length === 0) return;
  
  // Deduplicate by URI (keep last occurrence)
  const seenPosts = new Map<string, any>();
  for (const post of batches.posts) {
    seenPosts.set(post.uri, post);
  }
  const batch = Array.from(seenPosts.values());
  batches.posts = [];
  
  try {
    const { error } = await supabase
      .from('bluesky_posts')
      .upsert(batch, { onConflict: 'uri', ignoreDuplicates: false });
    
    if (error) throw error;
    
    stats.totalPosts += batch.length;
    console.log(`✓ Flushed ${batch.length} posts (total: ${stats.totalPosts.toLocaleString()})`);
  } catch (error: any) {
    console.error('Error flushing posts:', error.message);
    stats.errors++;
    // Re-add to batch for retry
    batches.posts.push(...batch);
  }
}

async function flushLikes(): Promise<void> {
  if (batches.likes.length === 0) return;
  
  // Deduplicate by URI
  const seenLikes = new Map<string, any>();
  for (const like of batches.likes) {
    seenLikes.set(like.uri, like);
  }
  const batch = Array.from(seenLikes.values());
  batches.likes = [];
  
  try {
    const { error } = await supabase
      .from('bluesky_likes')
      .upsert(batch, { onConflict: 'uri', ignoreDuplicates: true });
    
    if (error && error.code !== '23503') throw error; // Ignore FK violations
    
    stats.totalLikes += batch.length;
    console.log(`✓ Flushed ${batch.length} likes (total: ${stats.totalLikes.toLocaleString()})`);
  } catch (error: any) {
    console.error('Error flushing likes:', error.message);
    stats.errors++;
  }
}

async function flushReposts(): Promise<void> {
  if (batches.reposts.length === 0) return;
  
  const batch = [...batches.reposts];
  batches.reposts = [];
  
  try {
    const { error } = await supabase
      .from('bluesky_reposts')
      .upsert(batch, { onConflict: 'uri', ignoreDuplicates: true });
    
    if (error && error.code !== '23503') throw error;
    
    stats.totalReposts += batch.length;
    console.log(`✓ Flushed ${batch.length} reposts (total: ${stats.totalReposts.toLocaleString()})`);
  } catch (error: any) {
    console.error('Error flushing reposts:', error.message);
    stats.errors++;
  }
}

async function flushFollows(): Promise<void> {
  if (batches.follows.length === 0) return;
  
  const batch = [...batches.follows];
  batches.follows = [];
  
  try {
    const { error } = await supabase
      .from('bluesky_follows')
      .upsert(batch, { onConflict: 'follower_did,following_did', ignoreDuplicates: true });
    
    if (error && error.code !== '23503') throw error;
    
    stats.totalFollows += batch.length;
    console.log(`✓ Flushed ${batch.length} follows (total: ${stats.totalFollows.toLocaleString()})`);
  } catch (error: any) {
    console.error('Error flushing follows:', error.message);
    stats.errors++;
  }
}

async function flushAll(): Promise<void> {
  await Promise.all([
    flushPosts(),
    flushLikes(),
    flushReposts(),
    flushFollows(),
  ]);
}

// ============================================================================
// DATA COLLECTION
// ============================================================================

async function collectUserPosts(did: string): Promise<void> {
  let cursor: string | undefined;
  let collected = 0;
  
  while (collected < CONFIG.maxPostsPerUser) {
    try {
      const response = await agent.getAuthorFeed({
        actor: did,
        limit: 100,
        cursor,
      });
      
      if (!response.data.feed || response.data.feed.length === 0) break;
      
      for (const item of response.data.feed) {
        const post = item.post;
        batches.posts.push({
          uri: post.uri,
          cid: post.cid,
          author_did: post.author.did,
          text: (post.record as any).text || '',
          created_at: (post.record as any).createdAt || new Date().toISOString(),
          reply_parent: (post.record as any).reply?.parent?.uri || null,
          reply_root: (post.record as any).reply?.root?.uri || null,
          like_count: post.likeCount || 0,
          repost_count: post.repostCount || 0,
          reply_count: post.replyCount || 0,
          indexed_at: post.indexedAt || new Date().toISOString(),
        });
        
        collected++;
        if (collected >= CONFIG.maxPostsPerUser) break;
      }
      
      if (batches.posts.length >= CONFIG.batchSize) {
        await flushPosts();
      }
      
      cursor = response.data.cursor;
      if (!cursor) break;
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.rateLimitDelay));
    } catch (error: any) {
      console.error(`Error collecting posts for ${did}:`, error.message);
      break;
    }
  }
}

async function collectUserLikes(did: string): Promise<void> {
  if (!CONFIG.collectLikes) return;
  
  let cursor: string | undefined;
  let collected = 0;
  const maxLikes = 500;
  
  while (collected < maxLikes) {
    try {
      const response = await agent.app.bsky.feed.getActorLikes({
        actor: did,
        limit: 100,
        cursor,
      });
      
      if (!response.data.feed || response.data.feed.length === 0) break;
      
      for (const item of response.data.feed) {
        const post = item.post;
        batches.likes.push({
          uri: `at://${did}/app.bsky.feed.like/${Date.now()}-${Math.random()}`,
          author_did: did,
          subject_uri: post.uri,
          subject_cid: post.cid,
          created_at: new Date().toISOString(),
        });
        
        collected++;
      }
      
      if (batches.likes.length >= CONFIG.batchSize) {
        await flushLikes();
      }
      
      cursor = response.data.cursor;
      if (!cursor) break;
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.rateLimitDelay));
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        break; // Private likes
      }
      console.error(`Error collecting likes for ${did}:`, error.message);
      break;
    }
  }
}

async function collectUserFollows(did: string): Promise<void> {
  if (!CONFIG.collectFollows) return;
  
  try {
    let cursor: string | undefined;
    let collected = 0;
    const maxFollows = 1000;
    
    while (collected < maxFollows) {
      const response = await agent.getFollows({ actor: did, limit: 100, cursor });
      
      if (!response.data.follows || response.data.follows.length === 0) break;
      
      for (const follow of response.data.follows) {
        batches.follows.push({
          follower_did: did,
          following_did: follow.did,
          created_at: new Date().toISOString(),
        });
        
        collected++;
      }
      
      if (batches.follows.length >= CONFIG.batchSize) {
        await flushFollows();
      }
      
      cursor = response.data.cursor;
      if (!cursor) break;
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.rateLimitDelay));
    }
  } catch (error: any) {
    console.error(`Error collecting follows for ${did}:`, error.message);
  }
}

async function processUser(user: UserBatch): Promise<void> {
  try {
    console.log(`[${user.index}] Processing @${user.handle} (${user.did})`);
    
    await collectUserPosts(user.did);
    await collectUserLikes(user.did);
    await collectUserFollows(user.did);
    
    stats.processedUsers++;
    
    // Checkpoint periodically
    if (stats.processedUsers % CONFIG.checkpointInterval === 0) {
      await flushAll();
      saveCheckpoint(user.index);
      
      const elapsed = (Date.now() - stats.startTime) / 1000 / 60;
      const rate = stats.processedUsers / elapsed;
      console.log(`\n📊 Progress: ${stats.processedUsers} users | ${rate.toFixed(1)} users/min | ${stats.errors} errors\n`);
    }
  } catch (error: any) {
    console.error(`Failed to process user ${user.handle}:`, error.message);
    stats.errors++;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('\n🚀 Starting Bluesky Social Graph Backfill v2\n');
  console.log('Configuration:');
  console.log(`  Concurrency: ${CONFIG.concurrency}`);
  console.log(`  Batch Size: ${CONFIG.batchSize}`);
  console.log(`  Rate Limit: ${CONFIG.rateLimitDelay}ms`);
  console.log(`  Max Posts/User: ${CONFIG.maxPostsPerUser}`);
  console.log(`  Collect Likes: ${CONFIG.collectLikes}`);
  console.log(`  Collect Reposts: ${CONFIG.collectReposts}`);
  console.log(`  Collect Follows: ${CONFIG.collectFollows}\n`);
  
  await initAgent();
  
  // Load checkpoint
  const checkpoint = loadCheckpoint();
  const startIndex = checkpoint?.lastProcessedIndex || 0;
  
  if (checkpoint) {
    console.log(`📍 Resuming from index ${startIndex} (processed ${checkpoint.processedUsers} users)\n`);
    stats.processedUsers = checkpoint.processedUsers;
    stats.totalPosts = checkpoint.collectedPosts;
    stats.totalLikes = checkpoint.collectedLikes;
    stats.totalReposts = checkpoint.collectedReposts;
    stats.totalFollows = checkpoint.collectedFollows;
  }
  
  // Fetch users from database
  // Fetch users from database via keyset pagination (by did)
  const PAGE = 1000;
  console.log('📥 Loading users from database (keyset)...');
  let users: { did: string; handle: string }[] = [];
  let lastDid = (checkpoint && checkpoint.lastDid) || '';
  (global as any)._lastDid = lastDid;
  while (true) {
    let query = supabase
      .from('bluesky_users')
      .select('did, handle')
      .order('did', { ascending: true })
      .limit(PAGE);
    if (lastDid) query = query.gt('did', lastDid);
    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to load users: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    users.push(...data);
    lastDid = data[data.length - 1].did;
    (global as any)._lastDid = lastDid;
    if (users.length >= 100000) break; // bound memory per run
  }
  console.log(`✓ Loaded ${users.length.toLocaleString()} users (keyset)\n`);
  
  // Process users in batches with concurrency control
  for (let i = 0; i < users.length; i += CONFIG.concurrency) {
    const batch = users.slice(i, i + CONFIG.concurrency).map((u, idx) => ({
      did: u.did,
      handle: u.handle,
      index: startIndex + i + idx,
    }));
    
    await Promise.all(batch.map(processUser));
  }
  
  // Final flush
  await flushAll();
  saveCheckpoint(startIndex + users.length);
  
  console.log('\n✅ Backfill completed!');
  console.log(`📊 Final Stats:`);
  console.log(`  Users Processed: ${stats.processedUsers.toLocaleString()}`);
  console.log(`  Posts Collected: ${stats.totalPosts.toLocaleString()}`);
  console.log(`  Likes Collected: ${stats.totalLikes.toLocaleString()}`);
  console.log(`  Reposts Collected: ${stats.totalReposts.toLocaleString()}`);
  console.log(`  Follows Collected: ${stats.totalFollows.toLocaleString()}`);
  console.log(`  Errors: ${stats.errors}`);
  
  const elapsed = (Date.now() - stats.startTime) / 1000 / 60;
  console.log(`  Time: ${elapsed.toFixed(1)} minutes\n`);
}

// ============================================================================
// ERROR HANDLING & CLEANUP
// ============================================================================

process.on('SIGINT', async () => {
  console.log('\n⏸️  Received SIGINT, saving progress...');
  await flushAll();
  saveCheckpoint(stats.processedUsers);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⏸️  Received SIGTERM, saving progress...');
  await flushAll();
  saveCheckpoint(stats.processedUsers);
  process.exit(0);
});

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  saveCheckpoint(stats.processedUsers);
  process.exit(1);
});
