import 'dotenv/config';
import { BskyAgent } from '@atproto/api';
import { supabase } from './supabase.js';

/**
 * Engagement Collector
 * 
 * Collects engagement metrics (likes, reposts, replies) for all users in the database.
 * Implements rate limiting to avoid hitting Bluesky API limits.
 */

// Configuration
const POSTS_TO_ANALYZE = 50;
const USERS_PER_BATCH = 10;
const DELAY_BETWEEN_USERS = 2000;
const DELAY_BETWEEN_POSTS = 500;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

interface EngagementMetrics {
  user_did: string;
  total_likes: number;
  total_reposts: number;
  total_replies: number;
  total_posts: number;
  avg_likes_per_post: number;
  avg_reposts_per_post: number;
  avg_replies_per_post: number;
  max_likes_single_post: number;
  max_reposts_single_post: number;
  max_replies_single_post: number;
  posts_analyzed: number;
}

let agent: BskyAgent;
let totalUsersProcessed = 0;
let totalErrors = 0;
let lastProcessedDid: string | null = null;

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

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  retries = MAX_RETRIES
): Promise<T | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const isRateLimit = error?.message?.includes('rate limit') || error?.status === 429;
      const isLastAttempt = attempt === retries;

      if (isRateLimit && !isLastAttempt) {
        console.warn(`⚠️  Rate limit hit in ${operationName}, waiting ${RETRY_DELAY}ms before retry ${attempt}/${retries}`);
        await sleep(RETRY_DELAY);
        continue;
      }

      if (!isLastAttempt) {
        console.warn(`⚠️  Error in ${operationName} (attempt ${attempt}/${retries}):`, error?.message || error);
        await sleep(RETRY_DELAY);
        continue;
      }

      console.error(`❌ ${operationName} failed after ${retries} attempts:`, error?.message || error);
      return null;
    }
  }
  return null;
}

async function collectEngagementForUser(did: string, handle: string): Promise<EngagementMetrics | null> {
  try {
    const feedRes = await withRetry(
      () => agent.getAuthorFeed({ actor: did, limit: POSTS_TO_ANALYZE }),
      `getAuthorFeed for ${handle}`
    );

    if (!feedRes || !feedRes.data.feed.length) {
      return {
        user_did: did,
        total_likes: 0,
        total_reposts: 0,
        total_replies: 0,
        total_posts: 0,
        avg_likes_per_post: 0,
        avg_reposts_per_post: 0,
        avg_replies_per_post: 0,
        max_likes_single_post: 0,
        max_reposts_single_post: 0,
        max_replies_single_post: 0,
        posts_analyzed: 0,
      };
    }

    let totalLikes = 0;
    let totalReposts = 0;
    let totalReplies = 0;
    let maxLikes = 0;
    let maxReposts = 0;
    let maxReplies = 0;
    let postsAnalyzed = 0;

    for (const feedItem of feedRes.data.feed) {
      const post = feedItem.post;
      
      const likeCount = post.likeCount || 0;
      const repostCount = post.repostCount || 0;
      const replyCount = post.replyCount || 0;

      totalLikes += likeCount;
      totalReposts += repostCount;
      totalReplies += replyCount;

      maxLikes = Math.max(maxLikes, likeCount);
      maxReposts = Math.max(maxReposts, repostCount);
      maxReplies = Math.max(maxReplies, replyCount);

      postsAnalyzed++;

      if (postsAnalyzed < feedRes.data.feed.length) {
        await sleep(DELAY_BETWEEN_POSTS);
      }
    }

    const totalPosts = feedRes.data.feed.length;
    const avgLikes = totalPosts > 0 ? totalLikes / totalPosts : 0;
    const avgReposts = totalPosts > 0 ? totalReposts / totalPosts : 0;
    const avgReplies = totalPosts > 0 ? totalReplies / totalPosts : 0;

    return {
      user_did: did,
      total_likes: totalLikes,
      total_reposts: totalReposts,
      total_replies: totalReplies,
      total_posts: totalPosts,
      avg_likes_per_post: Math.round(avgLikes * 100) / 100,
      avg_reposts_per_post: Math.round(avgReposts * 100) / 100,
      avg_replies_per_post: Math.round(avgReplies * 100) / 100,
      max_likes_single_post: maxLikes,
      max_reposts_single_post: maxReposts,
      max_replies_single_post: maxReplies,
      posts_analyzed: postsAnalyzed,
    };
  } catch (error: any) {
    console.error(`❌ Failed to collect engagement for ${handle}:`, error?.message || error);
    totalErrors++;
    return null;
  }
}

async function saveEngagementMetrics(metrics: EngagementMetrics[]) {
  if (metrics.length === 0) return;

  try {
    const { error } = await supabase
      .from('engagement_metrics')
      .upsert(
        metrics.map(m => ({
          ...m,
          collection_date: new Date().toISOString(),
          collection_date_only: new Date().toISOString().slice(0,10),
        })),
        {
          onConflict: 'user_did,collection_date_only',
          ignoreDuplicates: false,
        }
      );

    if (error) throw error;
    console.log(`✓ Saved engagement metrics for ${metrics.length} users`);
  } catch (error) {
    console.error('❌ Failed to save engagement metrics:', error);
    throw error;
  }
}

async function getLastProcessedUser(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('engagement_metrics')
      .select('user_did')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data.user_did;
  } catch {
    return null;
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         ENGAGEMENT METRICS COLLECTOR                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  await initAgent();

  lastProcessedDid = await getLastProcessedUser();
  if (lastProcessedDid) {
    console.log(`📍 Resuming from last processed user: ${lastProcessedDid}\n`);
  }

  console.log('Loading users from database...');
  const allUsers: { did: string; handle: string }[] = [];
  
  try {
    let lastIndexedAt: string | null = null;
    const loadBatchSize = 1000;
    let skipUntilFound = lastProcessedDid !== null;

    while (true) {
      let query = supabase
        .from('bluesky_users')
        .select('did, handle, indexed_at')
        .order('indexed_at', { ascending: true })
        .limit(loadBatchSize);

      if (lastIndexedAt) {
        query = query.gt('indexed_at', lastIndexedAt);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;

      if (skipUntilFound) {
        const foundIndex = data.findIndex(u => u.did === lastProcessedDid);
        if (foundIndex >= 0) {
          allUsers.push(...data.slice(foundIndex + 1));
          skipUntilFound = false;
        }
      } else {
        allUsers.push(...data);
      }

      lastIndexedAt = data[data.length - 1].indexed_at;
    }

    console.log(`✓ Loaded ${allUsers.length.toLocaleString()} users to process\n`);
  } catch (error) {
    console.error('❌ Failed to load users:', error);
    process.exit(1);
  }

  if (allUsers.length === 0) {
    console.log('✓ No users to process. All done!');
    return;
  }

  console.log('⚙️  Configuration:');
  console.log(`   - Posts to analyze per user: ${POSTS_TO_ANALYZE}`);
  console.log(`   - Users per batch: ${USERS_PER_BATCH}`);
  console.log(`   - Delay between users: ${DELAY_BETWEEN_USERS}ms`);
  console.log(`   - Delay between posts: ${DELAY_BETWEEN_POSTS}ms`);
  console.log(`   - Max retries: ${MAX_RETRIES}`);
  console.log();

  const startTime = Date.now();
  const metricsBatch: EngagementMetrics[] = [];

  console.log('🚀 Starting engagement collection...\n');

  for (let i = 0; i < allUsers.length; i++) {
    const user = allUsers[i];
    const progress = ((i + 1) / allUsers.length * 100).toFixed(1);

    console.log(`[${i + 1}/${allUsers.length}] (${progress}%) Processing @${user.handle}...`);

    const metrics = await collectEngagementForUser(user.did, user.handle);
    
    if (metrics) {
      metricsBatch.push(metrics);
      totalUsersProcessed++;

      console.log(`   ✓ Collected: ${metrics.posts_analyzed} posts, ${metrics.total_likes} likes, ${metrics.total_reposts} reposts, ${metrics.total_replies} replies`);
    }

    if (metricsBatch.length >= USERS_PER_BATCH) {
      await saveEngagementMetrics(metricsBatch);
      metricsBatch.length = 0;
    }

    if (i < allUsers.length - 1) {
      await sleep(DELAY_BETWEEN_USERS);
    }

    if ((i + 1) % 50 === 0) {
      const elapsed = Date.now() - startTime;
      const avgTimePerUser = elapsed / (i + 1);
      const remainingUsers = allUsers.length - (i + 1);
      const estimatedTimeLeft = (avgTimePerUser * remainingUsers) / 1000 / 60;

      console.log();
      console.log(`📊 Progress Report:`);
      console.log(`   - Processed: ${i + 1}/${allUsers.length} (${progress}%)`);
      console.log(`   - Errors: ${totalErrors}`);
      console.log(`   - Avg time per user: ${(avgTimePerUser / 1000).toFixed(1)}s`);
      console.log(`   - Estimated time remaining: ${estimatedTimeLeft.toFixed(1)} minutes`);
      console.log();
    }
  }

  if (metricsBatch.length > 0) {
    await saveEngagementMetrics(metricsBatch);
  }

  const totalTime = (Date.now() - startTime) / 1000 / 60;

  console.log();
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                  COLLECTION COMPLETE                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`✓ Successfully processed ${totalUsersProcessed.toLocaleString()} users`);
  console.log(`✓ Total time: ${totalTime.toFixed(1)} minutes`);
  console.log(`✓ Average time per user: ${(totalTime * 60 / totalUsersProcessed).toFixed(1)} seconds`);
  console.log(`❌ Errors encountered: ${totalErrors}`);
  console.log();
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
