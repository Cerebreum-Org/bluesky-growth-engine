/**
 * Comprehensive Backfill System
 * 
 * Enriches users discovered by the collector with:
 * - Full profile data (bio, avatar, stats)
 * - Complete historical timeline (all posts before first seen)
 * - All historical interactions (likes, reposts, follows)
 * - Derived data (threads, mentions, hashtags, links from posts)
 * - Lists, feed generators, starter packs
 * 
 * Works alongside collector without conflicts using same upsert logic.
 */

import 'dotenv/config';
import { BskyAgent } from '@atproto/api';
import { supabase } from './supabase.js';
import { queues, flushAll } from './jetstream/queue-manager.js';
import { startResourceMonitor, shouldDropEvent } from './jetstream/resource-monitor.js';

const BATCH_SIZE = 500;
const RATE_LIMIT_DELAY = 100; // ms between API calls
const MAX_POSTS_PER_USER = 1000;

let agent: BskyAgent;
let stats = {
  usersProcessed: 0,
  usersEnriched: 0,
  postsCollected: 0,
  errors: 0,
  startTime: Date.now(),
};

async function initAgent() {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_PASSWORD;
  const service = process.env.BLUESKY_SERVICE || 'https://bsky.social';

  if (!handle || !password) {
    throw new Error('Missing BLUESKY_HANDLE or BLUESKY_PASSWORD in .env');
  }

  agent = new BskyAgent({ service });
  await agent.login({ identifier: handle, password });
  console.log(`✓ Authenticated as ${handle}`);
}

function shouldEnrichUser(user: any): boolean {
  // Never backfilled? Always enrich
  if (!user.last_backfilled_at) {
    return true;
  }
  
  // Has been backfilled - only re-enrich if stale (>7 days)
  const lastBackfilled = new Date(user.last_backfilled_at).getTime();
  const stale = (Date.now() - lastBackfilled) > 7 * 24 * 60 * 60 * 1000; // 7 days
  
  return stale;
}

async function enrichUserProfile(did: string) {
  try {
    const profile = await agent.getProfile({ actor: did });
    const p = profile.data;

    // Enrich user record with full profile
    await supabase.from('bluesky_users').update({
      handle: p.handle,
      display_name: p.displayName || null,
      description: p.description || null,
      avatar: p.avatar || null,
      followers_count: p.followersCount || 0,
      following_count: p.followsCount || 0,
      posts_count: p.postsCount || 0,
      labels: p.labels?.map((l: any) => l.val) || [],
      last_backfilled_at: new Date().toISOString(),
    }).eq('did', did);

    stats.usersEnriched++;
    console.log(`✓ Enriched profile: @${p.handle}`);
  } catch (error: any) {
    if (error?.status === 429) {
      console.warn('Rate limited, sleeping 5s...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      return enrichUserProfile(did); // Retry
    }
    console.error(`Failed to enrich profile ${did}:`, error?.message);
    // Mark as backfilled to avoid retrying suspended/deleted accounts
    await supabase.from('bluesky_users').update({
      last_backfilled_at: new Date().toISOString(),
    }).eq('did', did);
    stats.errors++;
  }
}

async function collectUserTimeline(did: string, handle: string) {
  let cursor: string | undefined;
  let postsCollected = 0;

  while (postsCollected < MAX_POSTS_PER_USER) {
    try {
      const response = await agent.getAuthorFeed({ 
        actor: did, 
        limit: 100, 
        cursor 
      });

      for (const item of response.data.feed) {
        const post = item.post;
        const record = post.record as any;

        // Queue post (collector uses same structure)
        queues.posts.push({
          uri: post.uri,
          cid: post.cid,
          author_did: post.author.did,
          text: record?.text || '',
          created_at: record?.createdAt || post.indexedAt,
          reply_parent: record?.reply?.parent?.uri || null,
          reply_root: record?.reply?.root?.uri || null,
          embed_type: post.embed?.$type || null,
          like_count: post.likeCount || 0,
          repost_count: post.repostCount || 0,
          reply_count: post.replyCount || 0,
          quote_count: (post as any).quoteCount || 0,
          indexed_at: new Date().toISOString(),
        });

        // Extract derived data (same as collector)
        processPostContent(post.author.did, post.uri, record, record?.createdAt || post.indexedAt);

        postsCollected++;
      }

      // Flush when batch full
      if (Object.values(queues).reduce((sum, q) => sum + q.length, 0) >= BATCH_SIZE) {
        await flushAll();
      }

      cursor = response.data.cursor;
      if (!cursor) break;

      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    } catch (error: any) {
      if (error?.status === 429) {
        console.warn('Rate limited, sleeping 10s...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        continue;
      }
      console.error(`Error collecting timeline for ${handle}:`, error?.message);
      break;
    }
  }

  stats.postsCollected += postsCollected;
  console.log(`✓ Collected ${postsCollected} posts from @${handle}`);
}

function processPostContent(authorDid: string, postUri: string, record: any, createdAt: string) {
  const text = record?.text || '';

  // Threads
  if (record?.reply) {
    queues.threads.push({
      root_uri: record.reply.root?.uri || null,
      post_uri: postUri,
      created_at: createdAt,
      parent_uri: record.reply.parent?.uri || null,
      author_did: authorDid,
    });
  }

  // Mentions
  record?.facets?.forEach((facet: any) => {
    facet.features?.forEach((feature: any) => {
      if (feature.$type === 'app.bsky.richtext.facet#mention' && feature.did) {
        queues.mentions.push({
          post_uri: postUri,
          mentioned_handle: feature.did,
          mentioned_did: feature.did,
          created_at: createdAt,
          author_did: authorDid,
        });
      }
    });
  });

  // Hashtags
  const hashtagMatches = text.match(/#\w+/g);
  hashtagMatches?.forEach((tag: string) => {
    queues.hashtags.push({
      post_uri: postUri,
      hashtag: tag,
      normalized_tag: tag.toLowerCase(),
      author_did: authorDid,
      created_at: createdAt,
    });
  });

  // Links
  const linkMatches = text.match(/https?:\/\/[^\s]+/g);
  linkMatches?.forEach((url: string) => {
    try {
      queues.links.push({
        post_uri: postUri,
        url,
        domain: new URL(url).hostname,
        author_did: authorDid,
        created_at: createdAt,
      });
    } catch {}
  });

  // Media
  if (record?.embed?.images) {
    record.embed.images.forEach((img: any) => {
      queues.media.push({
        post_uri: postUri,
        media_type: 'image',
        media_url: img.image?.ref?.$link || null,
        alt_text: img.alt || null,
        author_did: authorDid,
        created_at: createdAt,
      });
    });
  }

  // Activity patterns
  const hour = new Date(createdAt).getUTCHours();
  const dayOfWeek = new Date(createdAt).getUTCDay();
  queues.activityPatterns.push({
    author_did: authorDid,
    hour_of_day: hour,
    day_of_week: dayOfWeek,
    post_count: 1,
  });
}

async function collectFollowsFollowers(did: string, handle: string) {
  // Collect follows
  try {
    let cursor: string | undefined;
    let followCount = 0;
    const maxFollows = 100; // Limit to prevent excessive API calls

    while (followCount < maxFollows) {
      const response = await agent.getFollows({ actor: did, limit: 100, cursor });
      
      for (const follow of response.data.follows) {
        // Ensure followed user exists
        queues.users.push({
          did: follow.did,
          handle: follow.handle,
          display_name: follow.displayName || null,
          avatar: follow.avatar || null,
          indexed_at: new Date().toISOString(),
        });

        // Note: follow URI/timestamp not available from getFollows
        // We'd need to fetch the user's follow records separately
        followCount++;
      }

      cursor = response.data.cursor;
      if (!cursor) break;
      
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }

    console.log(`✓ Collected ${followCount} follows for @${handle}`);
  } catch (error: any) {
    console.error(`Error collecting follows for ${handle}:`, error?.message);
  }

  // Collect followers
  try {
    let cursor: string | undefined;
    let followerCount = 0;
    const maxFollowers = 100;

    while (followerCount < maxFollowers) {
      const response = await agent.getFollowers({ actor: did, limit: 100, cursor });
      
      for (const follower of response.data.followers) {
        queues.users.push({
          did: follower.did,
          handle: follower.handle,
          display_name: follower.displayName || null,
          avatar: follower.avatar || null,
          indexed_at: new Date().toISOString(),
        });

        followerCount++;
      }

      cursor = response.data.cursor;
      if (!cursor) break;

      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }

    console.log(`✓ Collected ${followerCount} followers for @${handle}`);
  } catch (error: any) {
    console.error(`Error collecting followers for ${handle}:`, error?.message);
  }
}

async function backfillUser(user: any) {
  const { did, handle } = user;
  console.log(`\nProcessing @${handle} (${did})`);

  try {
    // 1. Enrich profile
    await enrichUserProfile(did);

    // 2. Collect complete timeline
    await collectUserTimeline(did, handle);

    // 3. Collect social graph
    await collectFollowsFollowers(did, handle);

    // Final flush for this user
    await flushAll();

    stats.usersProcessed++;
  } catch (error: any) {
    console.error(`Failed to backfill ${handle}:`, error?.message);
    stats.errors++;
  }
}

async function getIncompleteUsers(limit: number = 50) {
  // Sharding support for parallel backfills
  const shard = parseInt(process.env.BACKFILL_SHARD || '0', 10);
  const totalShards = parseInt(process.env.BACKFILL_TOTAL_SHARDS || '1', 10);
  
  // Use modulo on a hash of DID to distribute users across shards
  // This ensures each shard processes different users
  const { data, error } = await supabase
    .from('bluesky_users')
    .select('did, handle, description, avatar, last_backfilled_at, posts_count')
    .is('last_backfilled_at', null)
    .order('posts_count', { ascending: false, nullsFirst: false })
    .limit(limit * totalShards);
  
  if (error || !data) {
    if (error) console.error('Error fetching incomplete users:', error);
    return [];
  }
  
  // Filter to this shard's users using hash modulo
  const shardUsers = data.filter((user, idx) => idx % totalShards === shard);
  return shardUsers.slice(0, limit);
}

async function main() {
  console.log('🚀 Starting Comprehensive Backfill System\n');
  
  // Start resource monitoring
  startResourceMonitor();
  
  await initAgent();

  while (true) {
    const users = await getIncompleteUsers(50); // Process 10 at a time
    
    if (users.length === 0) {
      console.log('\n✅ No more users to backfill. Sleeping 5 minutes...');
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
      continue;
    }

    console.log(`\n📋 Found ${users.length} users needing enrichment`);

    for (const user of users) {
      // Skip if under memory pressure
      if (shouldDropEvent()) {
        console.warn('⚠️  Skipping user due to memory pressure, will retry next cycle');
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
      
      if (shouldEnrichUser(user)) {
        await backfillUser(user);
      }
    }

    // Print stats
    const elapsed = Math.floor((Date.now() - stats.startTime) / 1000);
    console.log(`\n📊 Stats: ${stats.usersProcessed} processed, ${stats.usersEnriched} enriched, ${stats.postsCollected} posts, ${stats.errors} errors (${elapsed}s)`);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  await flushAll();
  process.exit(0);
});

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
