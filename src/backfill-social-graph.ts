/**
 * Social Graph Backfill - Refactored
 * 
 * Collects the entire Bluesky network with unlimited growth.
 * Now modularized for maintainability.
 */

import 'dotenv/config';
import { BskyAgent } from '@atproto/api';
import { supabase } from './supabase.js';
import { backfillConfig, createStats, BackfillStats } from './backfill/config.js';
import { BatchManager } from './backfill/persistence.js';

let agent: BskyAgent;
const stats: BackfillStats = createStats();
const batchManager = new BatchManager();

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

async function collectUserPosts(did: string) {
  let cursor: string | undefined;
  let hasMore = true;
  let postCount = 0;

  while (hasMore && postCount < backfillConfig.maxPostsPerUser) {
    try {
      const response = await agent.getAuthorFeed({ actor: did, limit: 100, cursor });
      
      for (const item of response.data.feed) {
        const post = item.post;
        
        // Upsert post author
        if (!batchManager.userDids.has(post.author.did)) {
          await supabase.from('bluesky_users').upsert({
            did: post.author.did,
            handle: post.author.handle,
            display_name: post.author.displayName || null,
            avatar: post.author.avatar || null,
            indexed_at: new Date().toISOString(),
          }, { onConflict: 'did' });
          batchManager.userDids.add(post.author.did);
        }

        // Add post to batch
        batchManager.addPost({
          uri: post.uri,
          cid: post.cid,
          author_did: post.author.did,
          text: (post.record as any)?.text || '',
          created_at: post.indexedAt,
          reply_parent: (post.record as any)?.reply?.parent?.uri || null,
          reply_root: (post.record as any)?.reply?.root?.uri || null,
          embed_type: post.embed?.$type || null,
          embed_uri: (post.embed as any)?.uri || null,
          like_count: post.likeCount || 0,
          repost_count: post.repostCount || 0,
          reply_count: post.replyCount || 0,
          quote_count: (post as any).quoteCount || 0,
          indexed_at: new Date().toISOString(),
        });

        postCount++;

        if (batchManager.shouldFlush(backfillConfig.batchSize)) {
          const flushed = await batchManager.flushAll();
          stats.totalPosts += flushed.posts;
          stats.totalLikes += flushed.likes;
          stats.totalReposts += flushed.reposts;
          stats.totalFollows += flushed.follows;
        }

        // Optionally collect likes/reposts
        if (backfillConfig.collectLikesReposts) {
          await collectPostLikes(post.uri, post.cid);
          await collectPostReposts(post.uri, post.cid);
        }
      }

      cursor = response.data.cursor;
      hasMore = !!cursor;
      
      await new Promise(resolve => setTimeout(resolve, backfillConfig.rateLimitDelay));
    } catch (error) {
      console.error(`Error collecting posts for ${did}:`, error);
      break;
    }
  }
}

async function collectPostLikes(postUri: string, postCid: string) {
  try {
    const response = await agent.getLikes({ uri: postUri, limit: 100 });
    
    for (const like of response.data.likes) {
      const key = `${like.actor.did}:${postUri}`;
      if (batchManager.seenLikeKeys.has(key)) continue;
      batchManager.seenLikeKeys.add(key);

      // Upsert like author
      if (!batchManager.userDids.has(like.actor.did)) {
        await supabase.from('bluesky_users').upsert({
          did: like.actor.did,
          handle: like.actor.handle,
          display_name: like.actor.displayName || null,
          avatar: like.actor.avatar || null,
          indexed_at: new Date().toISOString(),
        }, { onConflict: 'did' });
        batchManager.userDids.add(like.actor.did);
      }

      const likeUri = `at://${like.actor.did}/app.bsky.feed.like/${Buffer.from(postUri).toString('base64url')}`;
      batchManager.addLike({
        uri: likeUri,
        author_did: like.actor.did,
        subject_uri: postUri,
        subject_cid: postCid,
        created_at: like.createdAt || like.indexedAt,
        indexed_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    // Skip errors
  }
}

async function collectPostReposts(postUri: string, postCid: string) {
  try {
    const response = await agent.getRepostedBy({ uri: postUri, limit: 100 });
    
    for (const reposter of response.data.repostedBy) {
      const key = `${reposter.did}:${postUri}`;
      if (batchManager.seenRepostKeys.has(key)) continue;
      batchManager.seenRepostKeys.add(key);

      // Upsert reposter
      if (!batchManager.userDids.has(reposter.did)) {
        await supabase.from('bluesky_users').upsert({
          did: reposter.did,
          handle: reposter.handle,
          display_name: reposter.displayName || null,
          avatar: reposter.avatar || null,
          indexed_at: new Date().toISOString(),
        }, { onConflict: 'did' });
        batchManager.userDids.add(reposter.did);
      }

      const repostUri = `at://${reposter.did}/app.bsky.feed.repost/${Buffer.from(postUri).toString('base64url')}`;
      batchManager.addRepost({
        uri: repostUri,
        author_did: reposter.did,
        subject_uri: postUri,
        subject_cid: postCid,
        created_at: new Date().toISOString(),
        indexed_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    // Skip errors
  }
}

async function collectUserFollows(did: string) {
  if (backfillConfig.skipFollows) return;

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await agent.getFollows({ actor: did, limit: 100, cursor });
      
      for (const follow of response.data.follows) {
        // Upsert discovered user
        if (!batchManager.userDids.has(follow.did)) {
          await supabase.from('bluesky_users').upsert({
            did: follow.did,
            handle: follow.handle,
            display_name: follow.displayName || null,
            avatar: follow.avatar || null,
            indexed_at: new Date().toISOString(),
          }, { onConflict: 'did' });
          batchManager.userDids.add(follow.did);
        }

        batchManager.addFollow({
          follower_did: did,
          following_did: follow.did,
          indexed_at: new Date().toISOString(),
        });
      }

      cursor = response.data.cursor;
      hasMore = !!cursor;
      
      await new Promise(resolve => setTimeout(resolve, backfillConfig.rateLimitDelay));
    } catch (error) {
      console.error(`Error collecting follows for ${did}:`, error);
      break;
    }
  }
}

async function processUser(did: string, handle: string) {
  console.log(`[${stats.processedUsers + 1}] Processing @${handle} (${did})`);
  
  await collectUserPosts(did);
  await collectUserFollows(did);
  
  const flushed = await batchManager.flushAll();
  stats.totalPosts += flushed.posts;
  stats.totalLikes += flushed.likes;
  stats.totalReposts += flushed.reposts;
  stats.totalFollows += flushed.follows;
  
  stats.processedUsers++;
  
  if (stats.processedUsers % 10 === 0) {
    console.log(`Progress: ${stats.processedUsers} users, ${stats.totalPosts} posts, ${stats.totalLikes} likes, ${stats.totalReposts} reposts, ${stats.totalFollows} follows`);
  }
}

async function main() {
  await initAgent();
  
  console.log('Starting unlimited social graph collection...');
  
  // Seed with authenticated user
  const profile = await agent.getProfile({ actor: agent.session!.did });
  await supabase.from('bluesky_users').upsert({
    did: profile.data.did,
    handle: profile.data.handle,
    display_name: profile.data.displayName || null,
    avatar: profile.data.avatar || null,
    indexed_at: new Date().toISOString(),
  }, { onConflict: 'did' });
  
  // Process authenticated user first
  await processUser(profile.data.did, profile.data.handle);
  
  // Continue with all discovered users
  while (true) {
    const { data: users, error } = await supabase
      .from('bluesky_users')
      .select('did, handle')
      .order('indexed_at', { ascending: true })
      .limit(backfillConfig.batchSize);
    
    if (error || !users || users.length === 0) break;
    
    for (const user of users) {
      if (!batchManager.userDids.has(user.did)) {
        await processUser(user.did, user.handle);
      }
    }
  }
  
  console.log('\n✓ Backfill complete!');
  console.log(`Total: ${stats.totalUsers} users, ${stats.totalPosts} posts, ${stats.totalLikes} likes, ${stats.totalReposts} reposts, ${stats.totalFollows} follows`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
