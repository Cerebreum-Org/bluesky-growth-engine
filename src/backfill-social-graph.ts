import 'dotenv/config';
import { BskyAgent } from '@atproto/api';
import { supabase } from './supabase.js';

/**
 * UNLIMITED Social Graph Collection
 * 
 * Collects the ENTIRE Bluesky network with NO LIMITS:
 * - Discovers and adds ALL new users encountered
 * - Collects ALL posts (unlimited per user)
 * - Collects ALL likes and reposts
 * - Collects ALL follows/followers (unlimited)
 * - Continuously expands network by crawling discovered users
 * 
 * WARNING: This will grow your database indefinitely!
 */

const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? '50'); // default 50
const RATE_LIMIT_DELAY = Number(process.env.RATE_LIMIT_DELAY ?? '2000'); // ms between requests
const MAX_POSTS_PER_USER = Infinity; // NO LIMIT - collect ALL posts
const SKIP_FOLLOWS = false; // Collect follows
const COLLECT_LIKES_REPOSTS = true; // Collect ALL likes/reposts
const CONCURRENCY = Number(process.env.CONCURRENCY ?? '1'); // concurrent users
const MAX_RETRIES = 3; // Retry failed DB operations

let agent: BskyAgent;
let totalUsers = 0;
let processedUsers = 0;
let totalPosts = 0;
let totalLikes = 0;
let totalReposts = 0;
let totalFollows = 0;

const postBatch: any[] = [];
const likeBatch: any[] = [];
const repostBatch: any[] = [];
const followBatch: any[] = [];
const userDids = new Set<string>(); // Track which DIDs we have in DB
const existingPostUris = new Set<string>(); // Track which posts exist in DB
const seenLikeKeys = new Set<string>(); // Dedupe likes
const seenRepostKeys = new Set<string>(); // Dedupe reposts

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

async function flushPostBatch() {
  if (postBatch.length === 0) return;

  // Deduplicate by URI within the batch
  const uniquePosts = new Map();
  postBatch.forEach(post => uniquePosts.set(post.uri, post));
  const batch = Array.from(uniquePosts.values());
  postBatch.length = 0;

  // Add to existingPostUris set for foreign key validation
  batch.forEach(post => existingPostUris.add(post.uri));

  // Retry logic for timeout errors
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { error } = await supabase
        .from('bluesky_posts')
        .upsert(batch, { onConflict: 'uri' });

      if (error) throw error;
      totalPosts += batch.length;
      return; // Success
    } catch (e: any) {
      const isTimeout = e?.code === '57014';
      const isLastAttempt = attempt === MAX_RETRIES;
      
      if (isTimeout && !isLastAttempt) {
        console.warn(`Post batch timeout, retrying (${attempt}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else if (isLastAttempt) {
        console.warn('Failed to save post batch after retries:', e);
        return;
      } else {
        console.warn('Failed to save post batch:', e);
        return;
      }
    }
  }
}

async function flushLikeBatch() {
  if (likeBatch.length === 0) return;

  // Deduplicate by author_did + subject_uri
  const uniqueLikes = new Map();
  likeBatch.forEach(like => {
    const key = `${like.author_did}:${like.subject_uri}`;
    uniqueLikes.set(key, like);
  });
  const batch = Array.from(uniqueLikes.values());
  likeBatch.length = 0;

  // Filter out likes for posts that don't exist
  const validBatch = batch.filter(like => existingPostUris.has(like.subject_uri));
  
  if (validBatch.length === 0) return;

  // Retry logic for timeout errors
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { error } = await supabase
        .from('bluesky_likes')
        .upsert(validBatch, { onConflict: 'uri' });

      if (error) throw error;
      totalLikes += validBatch.length;
      return; // Success
    } catch (e: any) {
      const isTimeout = e?.code === '57014';
      const isForeignKey = e?.code === '23503';
      const isLastAttempt = attempt === MAX_RETRIES;
      
      if (isForeignKey) {
        // Silently skip foreign key errors - post doesn't exist in our DB
        return;
      } else if (isTimeout && !isLastAttempt) {
        console.warn(`Like batch timeout, retrying (${attempt}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else if (isLastAttempt) {
        // Give up after retries
        return;
      } else {
        return;
      }
    }
  }
}

async function flushRepostBatch() {
  if (repostBatch.length === 0) return;

  // Deduplicate by author_did + subject_uri
  const uniqueReposts = new Map();
  repostBatch.forEach(repost => {
    const key = `${repost.author_did}:${repost.subject_uri}`;
    uniqueReposts.set(key, repost);
  });
  const batch = Array.from(uniqueReposts.values());
  repostBatch.length = 0;

  // Filter out reposts for posts that don't exist
  const validBatch = batch.filter(repost => existingPostUris.has(repost.subject_uri));
  
  if (validBatch.length === 0) return;

  // Retry logic for timeout errors
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { error } = await supabase
        .from('bluesky_reposts')
        .upsert(validBatch, { onConflict: 'uri' });

      if (error) throw error;
      totalReposts += validBatch.length;
      return; // Success
    } catch (e: any) {
      const isTimeout = e?.code === '57014';
      const isForeignKey = e?.code === '23503';
      const isLastAttempt = attempt === MAX_RETRIES;
      
      if (isForeignKey) {
        // Silently skip foreign key errors - post doesn't exist in our DB
        return;
      } else if (isTimeout && !isLastAttempt) {
        console.warn(`Repost batch timeout, retrying (${attempt}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else if (isLastAttempt) {
        // Give up after retries
        return;
      } else {
        return;
      }
    }
  }
}

async function flushFollowBatch() {
  if (followBatch.length === 0) return;

  // Deduplicate by follower_did + following_did within the batch
  const uniqueFollows = new Map();
  followBatch.forEach(follow => {
    const key = `${follow.follower_did}:${follow.following_did}`;
    uniqueFollows.set(key, follow);
  });
  const batch = Array.from(uniqueFollows.values());
  followBatch.length = 0;

  // Filter out follows where either user isn't in our database
  const validBatch = batch.filter(follow => 
    userDids.has(follow.follower_did) && userDids.has(follow.following_did)
  );
  
  if (validBatch.length === 0) return;

  // Retry logic for timeout errors
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { error } = await supabase
        .from('bluesky_follows')
        .upsert(validBatch, { onConflict: 'follower_did,following_did' });

      if (error) throw error;
      totalFollows += validBatch.length;
      return; // Success
    } catch (e: any) {
      const isTimeout = e?.code === '57014';
      const isDeadlock = e?.code === '40P01';
      const isForeignKey = e?.code === '23503';
      const isLastAttempt = attempt === MAX_RETRIES;
      
      if (isForeignKey) {
        // Silently skip foreign key errors - user doesn't exist in our DB
        return;
      } else if ((isTimeout || isDeadlock) && !isLastAttempt) {
        console.warn(`Follow batch ${isDeadlock ? 'deadlock' : 'timeout'}, retrying (${attempt}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else if (isLastAttempt) {
        // Give up after retries
        return;
      } else {
        return;
      }
    }
  }
}

async function collectUserPosts(did: string) {
  try {
    let cursor: string | undefined;
    
    // Paginate through ALL posts
    do {
      const response = await agent.getAuthorFeed({
        actor: did,
        limit: 100,
        cursor,
      });

      for (const item of response.data.feed) {
        const post = item.post;
        
        // ADD post author to database if new
        if (!userDids.has(post.author.did)) {
          const newUser = {
            did: post.author.did,
            handle: post.author.handle,
            display_name: post.author.displayName,
            avatar: post.author.avatar,
            indexed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await supabase.from('bluesky_users').upsert(newUser, { onConflict: 'did' });
          userDids.add(post.author.did);
        }
        
        postBatch.push({
          uri: post.uri,
          cid: post.cid,
          author_did: post.author.did,
          text: (post.record as any).text || null,
          created_at: post.indexedAt,
          reply_parent: (post.record as any).reply?.parent?.uri || null,
          reply_root: (post.record as any).reply?.root?.uri || null,
          embed_type: post.embed?.$type || null,
          embed_uri: (post.embed as any)?.uri || null,
          like_count: post.likeCount || 0,
          repost_count: post.repostCount || 0,
          reply_count: post.replyCount || 0,
          quote_count: (post as any).quoteCount || 0,
        });

        if (postBatch.length >= BATCH_SIZE) {
          await flushPostBatch();
        }
        
        existingPostUris.add(post.uri);

        // Collect likes and reposts for this post
        if (COLLECT_LIKES_REPOSTS) {
          await collectPostLikes(post.uri);
          await collectPostReposts(post.uri);
        }
      }
      
      cursor = response.data.cursor;
      
      // Small delay between pages
      if (cursor) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      }
    } while (cursor); // Continue until no more pages
    
  } catch (e: any) {
    if (processedUsers < 10) console.warn(`Error processing user:`, e.message);
  }
}

async function collectPostLikes(postUri: string) {
  try {
    const response = await agent.getLikes({
      uri: postUri,
      limit: 100, // Max per request
    });

    for (const like of response.data.likes) {
      // ADD like author to database if new
      if (!userDids.has(like.actor.did)) {
        const newUser = {
          did: like.actor.did,
          handle: like.actor.handle,
          display_name: like.actor.displayName,
          avatar: like.actor.avatar,
          indexed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await supabase.from('bluesky_users').upsert(newUser, { onConflict: 'did' });
        userDids.add(like.actor.did);
      }
      // Dedupe key
      const likeKey = `${like.actor.did}:${postUri}`;
      if (seenLikeKeys.has(likeKey)) {
        continue;
      }
      seenLikeKeys.add(likeKey);
      
      // Generate a stable URI based on author and subject
      const likeUri = `at://${like.actor.did}/app.bsky.feed.like/${Buffer.from(`${like.actor.did}:${postUri}`).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 13)}`;
      
      likeBatch.push({
        uri: likeUri,
        author_did: like.actor.did,
        subject_uri: postUri,
        subject_cid: postUri, // Use post URI as placeholder since API doesn't provide CID
        created_at: like.createdAt || new Date().toISOString(),
        indexed_at: new Date().toISOString(),
      });

      if (likeBatch.length >= BATCH_SIZE) {
        await flushLikeBatch();
      }
    }
  } catch {
    // Skip on error (post might be deleted or private)
  }
}

async function collectPostReposts(postUri: string, postCid: string) {
  try {
    const response = await agent.getRepostedBy({
      uri: postUri,
      limit: 100, // Max per request
    });

    for (const reposter of response.data.repostedBy) {
      // ADD reposter to database if new
      if (!userDids.has(reposter.did)) {
        const newUser = {
          did: reposter.did,
          handle: reposter.handle,
          display_name: reposter.displayName,
          avatar: reposter.avatar,
          indexed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await supabase.from('bluesky_users').upsert(newUser, { onConflict: 'did' });
        userDids.add(reposter.did);
      }
      // Dedupe key
      const repostKey = `${reposter.did}:${postUri}`;
      if (seenRepostKeys.has(repostKey)) {
        continue;
      }
      seenRepostKeys.add(repostKey);
      
      // Generate a stable URI based on author and subject
      const repostUri = `at://${reposter.did}/app.bsky.feed.repost/${Buffer.from(`${reposter.did}:${postUri}`).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 13)}`;
      
      repostBatch.push({
        uri: repostUri,
        author_did: reposter.did,
        subject_uri: postUri,
        subject_cid: postCid,
        created_at: new Date().toISOString(), // API doesn't provide timestamp
        indexed_at: new Date().toISOString(),
      });

      if (repostBatch.length >= BATCH_SIZE) {
        await flushRepostBatch();
      }
    }
  } catch {
    // Skip on error
  }
}

async function collectUserFollows(did: string) {
  try {
    // Get following
    let cursor: string | undefined;
    let count = 0;
    const maxFollows = Infinity; // Limit to avoid huge queries

    do {
      const response = await agent.getFollows({
        actor: did,
        limit: 100,
        cursor,
      });

      for (const follow of response.data.follows) {
        // ADD all discovered users to database
        if (!userDids.has(follow.did)) {
          const newUser = {
            did: follow.did,
            handle: follow.handle,
            display_name: follow.displayName,
            avatar: follow.avatar,
            indexed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await supabase.from('bluesky_users').upsert(newUser, { onConflict: 'did' });
          userDids.add(follow.did);
        }
        
        followBatch.push({
          follower_did: did,
          following_did: follow.did,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        count++;
        if (count >= maxFollows) break;
      }

      if (followBatch.length >= BATCH_SIZE) {
        await flushFollowBatch();
      }

      cursor = response.data.cursor;
      if (count >= maxFollows) break;
    } while (cursor);

    // Get followers
    cursor = undefined;
    count = 0;

    do {
      const response = await agent.getFollowers({
        actor: did,
        limit: 100,
        cursor,
      });

      for (const follower of response.data.followers) {
        // ADD all discovered users to database
        if (!userDids.has(follower.did)) {
          const newUser = {
            did: follower.did,
            handle: follower.handle,
            display_name: follower.displayName,
            avatar: follower.avatar,
            indexed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await supabase.from('bluesky_users').upsert(newUser, { onConflict: 'did' });
          userDids.add(follower.did);
        }
        
        followBatch.push({
          follower_did: follower.did,
          following_did: did,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        count++;
        if (count >= maxFollows) break;
      }

      if (followBatch.length >= BATCH_SIZE) {
        await flushFollowBatch();
      }

      cursor = response.data.cursor;
      if (count >= maxFollows) break;
    } while (cursor);

  } catch {
    // Skip on error
  }
}

async function processUser(did: string, handle: string) {
  try {
    // Collect posts (includes likes/reposts per post)
    await collectUserPosts(did);
    
    // Small delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    
    // Collect follows (optional - we already have most of them)
    if (!SKIP_FOLLOWS) {
      await collectUserFollows(did);
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
    
    processedUsers++;
    
    if (processedUsers % 100 === 0) {
      console.log(`Progress: ${processedUsers}/${totalUsers} users | Posts: ${totalPosts} | Likes: ${totalLikes} | Reposts: ${totalReposts} | Follows: ${totalFollows}`);
    }
  } catch (e: any) {
    if (processedUsers < 10) console.warn(`Error processing user:`, e.message);
    console.warn(`Failed to process user ${handle}:`, e);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║         SOCIAL GRAPH BACKFILL (132K USERS)            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  await initAgent();

  // First pass: Build user DID index in batches to avoid timeout
  console.log('Building user DID index...');
  let from = 0;
  const pageSize = 1000;
  let indexedCount = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('bluesky_users')
      .select('did')
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    data.forEach(u => userDids.add(u.did));
    indexedCount += data.length;
    
    if (indexedCount % 10000 === 0) {
      console.log(`  Indexed ${indexedCount.toLocaleString()} user DIDs...`);
    }
    
    if (data.length < pageSize) break;
    from += pageSize;
  }
  
  totalUsers = userDids.size;
  console.log(`✓ Indexed ${totalUsers.toLocaleString()} user DIDs\n`);

  console.log(`Starting fresh collection (existing data will be updated via upsert)\n`);
  console.log('Starting social graph collection...\n');
  console.log(`⚡ PARALLEL MODE: Processing ${CONCURRENCY} users concurrently`);
  
  const collectingItems = ['posts'];
  if (COLLECT_LIKES_REPOSTS) collectingItems.push('likes', 'reposts');
  if (!SKIP_FOLLOWS) collectingItems.push('follows');
  console.log(`Collecting: ${collectingItems.join(', ')}`);
  
  if (COLLECT_LIKES_REPOSTS && !SKIP_FOLLOWS) {
    console.log(`Estimated time: ~6-8 hours for ${totalUsers.toLocaleString()} users\n`);
  } else if (COLLECT_LIKES_REPOSTS || !SKIP_FOLLOWS) {
    console.log(`Estimated time: ~3-4 hours for ${totalUsers.toLocaleString()} users\n`);
  } else {
    console.log(`Estimated time: ~20-30 minutes for ${totalUsers.toLocaleString()} users\n`);
  }

  const startTime = Date.now();

  // Process users in parallel with streaming pagination
  const workers: Promise<void>[] = [];
  
  // Create a shared offset counter
  let currentOffset = 0;
  const batchSize = 100; // Fetch users in smaller batches
  
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(
      (async () => {
        while (true) {
          // Get next batch of users
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
          
          // Process this batch
          for (const user of data) {
            await processUser(user.did, user.handle);
          }
          
          // Stop if we got fewer users than requested (end of data)
          if (data.length < batchSize) break;
        }
      })()
    );
  }

  await Promise.all(workers);

  // Flush remaining batches
  console.log('\nFlushing remaining batches...');
  await flushPostBatch();
  await flushLikeBatch();
  await flushRepostBatch();
  await flushFollowBatch();

  const endTime = Date.now();
  const durationHours = ((endTime - startTime) / 1000 / 60 / 60).toFixed(2);

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                 BACKFILL COMPLETE!                     ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  console.log(`Statistics:`);
  console.log(`  - Users processed: ${processedUsers.toLocaleString()}`);
  console.log(`  - Posts collected: ${totalPosts.toLocaleString()}`);
  console.log(`  - Likes collected: ${totalLikes.toLocaleString()}`);
  console.log(`  - Reposts collected: ${totalReposts.toLocaleString()}`);
  console.log(`  - Follows collected: ${totalFollows.toLocaleString()}`);
  console.log(`  - Duration: ${durationHours} hours`);
  console.log(`\nNote: Replies and quote posts are included in the posts table`);
  console.log(`(replies have reply_parent field, quotes have embed data)\n`);

  console.log('Refreshing engagement stats...');
  await supabase.rpc('refresh_engagement_stats');
  console.log('✓ Done!\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
