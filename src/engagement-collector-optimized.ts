import 'dotenv/config';
import { BskyAgent } from '@atproto/api';
import { supabase } from './supabase.js';

/**
 * Optimized Engagement Collector
 * 
 * Key optimizations:
 * - Parallel processing with controlled concurrency
 * - Removed unnecessary delays between posts (already in one API response)
 * - Larger batch sizes for database writes
 * - Skip recently processed users
 * - Better rate limit handling
 */

// OPTIMIZED Configuration
const POSTS_TO_ANALYZE = 50;
const CONCURRENT_USERS = 5; // Process 5 users in parallel
const USERS_PER_DB_BATCH = 50; // Batch 50 users before DB write (was 10)
const DELAY_BETWEEN_BATCHES = 1000; // 1s between batches (was 2s per user)
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;
const SKIP_RECENT_HOURS = 24; // Skip users processed in last 24 hours

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
let totalSkipped = 0;

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

    // OPTIMIZATION: No delay needed - posts are already in the response
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
        })),
        {
          onConflict: 'user_did',
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

async function getRecentlyProcessedDids(): Promise<Set<string>> {
  try {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - SKIP_RECENT_HOURS);

    const { data, error } = await supabase
      .from('engagement_metrics')
      .select('user_did')
      .gte('updated_at', cutoffTime.toISOString());

    if (error || !data) return new Set();
    return new Set(data.map(d => d.user_did));
  } catch {
    return new Set();
  }
}

// OPTIMIZATION: Process users in parallel with controlled concurrency
async function processBatch(users: Array<{ did: string; handle: string }>, recentlyProcessed: Set<string>) {
  const results: EngagementMetrics[] = [];
  
  for (let i = 0; i < users.length; i += CONCURRENT_USERS) {
    const batch = users.slice(i, i + CONCURRENT_USERS);
    
    const promises = batch.map(async (user) => {
      // Skip recently processed users
      if (recentlyProcessed.has(user.did)) {
        totalSkipped++;
        return null;
      }

      const metrics = await collectEngagementForUser(user.did, user.handle);
      if (metrics) {
        totalUsersProcessed++;
        console.log(`   ✓ @${user.handle}: ${metrics.posts_analyzed} posts, ${metrics.total_likes} likes`);
      }
      return metrics;
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter((m): m is EngagementMetrics => m !== null));

    // Small delay between concurrent batches
    if (i + CONCURRENT_USERS < users.length) {
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  return results;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║      OPTIMIZED ENGAGEMENT METRICS COLLECTOR               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  await initAgent();

  console.log('Loading users from database...');
  const allUsers: { did: string; handle: string }[] = [];
  
  try {
    let lastIndexedAt: string | null = null;
    const loadBatchSize = 1000;

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

      allUsers.push(...data);
      lastIndexedAt = data[data.length - 1].indexed_at;
    }

    console.log(`✓ Loaded ${allUsers.length.toLocaleString()} users from database\n`);
  } catch (error) {
    console.error('❌ Failed to load users:', error);
    process.exit(1);
  }

  if (allUsers.length === 0) {
    console.log('✓ No users to process. All done!');
    return;
  }

  // Load recently processed users to skip
  console.log('Checking for recently processed users...');
  const recentlyProcessed = await getRecentlyProcessedDids();
  console.log(`✓ Found ${recentlyProcessed.size} users processed in last ${SKIP_RECENT_HOURS} hours\n`);

  console.log('⚙️  Optimized Configuration:');
  console.log(`   - Posts to analyze per user: ${POSTS_TO_ANALYZE}`);
  console.log(`   - Concurrent users: ${CONCURRENT_USERS}`);
  console.log(`   - Database batch size: ${USERS_PER_DB_BATCH}`);
  console.log(`   - Delay between batches: ${DELAY_BETWEEN_BATCHES}ms`);
  console.log(`   - Skip if processed in last: ${SKIP_RECENT_HOURS} hours`);
  console.log(`   - Max retries: ${MAX_RETRIES}`);
  console.log();

  const startTime = Date.now();
  let allMetrics: EngagementMetrics[] = [];

  console.log('🚀 Starting optimized engagement collection...\n');

  for (let i = 0; i < allUsers.length; i += USERS_PER_DB_BATCH) {
    const userBatch = allUsers.slice(i, i + USERS_PER_DB_BATCH);
    const progress = ((i + userBatch.length) / allUsers.length * 100).toFixed(1);

    console.log(`\n[${i + 1}-${Math.min(i + USERS_PER_DB_BATCH, allUsers.length)}/${allUsers.length}] (${progress}%) Processing batch...`);

    const batchMetrics = await processBatch(userBatch, recentlyProcessed);
    
    if (batchMetrics.length > 0) {
      await saveEngagementMetrics(batchMetrics);
      allMetrics.push(...batchMetrics);
    }

    const elapsed = Date.now() - startTime;
    const processed = totalUsersProcessed + totalSkipped;
    const avgTimePerUser = processed > 0 ? elapsed / processed : 0;
    const remainingUsers = allUsers.length - (i + userBatch.length);
    const estimatedTimeLeft = (avgTimePerUser * remainingUsers) / 1000 / 60;

    console.log();
    console.log(`📊 Progress Report:`);
    console.log(`   - Processed: ${processed}/${allUsers.length} (${totalUsersProcessed} collected, ${totalSkipped} skipped)`);
    console.log(`   - Errors: ${totalErrors}`);
    console.log(`   - Avg time per user: ${(avgTimePerUser / 1000).toFixed(2)}s`);
    console.log(`   - Estimated time remaining: ${estimatedTimeLeft.toFixed(1)} minutes`);
  }

  const totalTime = (Date.now() - startTime) / 1000 / 60;
  const throughput = totalUsersProcessed / totalTime;

  console.log();
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                  COLLECTION COMPLETE                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`✓ Successfully processed ${totalUsersProcessed.toLocaleString()} users`);
  console.log(`⏭️  Skipped ${totalSkipped.toLocaleString()} recently processed users`);
  console.log(`✓ Total time: ${totalTime.toFixed(1)} minutes`);
  console.log(`✓ Throughput: ${throughput.toFixed(1)} users/minute`);
  console.log(`✓ Average time per user: ${(totalTime * 60 / totalUsersProcessed).toFixed(2)} seconds`);
  console.log(`❌ Errors encountered: ${totalErrors}`);
  console.log();
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
