import 'dotenv/config';
import { BskyAgent } from '@atproto/api';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { supabase } from './supabase.js';

/**
 * Proxy-Rotating Engagement Collector
 * 
 * Rotates through multiple proxies to distribute requests and avoid rate limits.
 * Add proxies to PROXY_LIST environment variable.
 */

// Configuration
const POSTS_TO_ANALYZE = 50;
const CONCURRENT_COLLECTORS = 3; // Number of parallel proxy workers
const USERS_PER_DB_BATCH = 50;

// Load proxies from env: "http://proxy1:port,http://proxy2:port,..."
const PROXY_LIST = (process.env.PROXY_LIST || '').split(',').filter(p => p.trim());

interface ProxyWorker {
  id: number;
  agent: BskyAgent;
  proxy: string;
  processed: number;
  errors: number;
}

let workers: ProxyWorker[] = [];

async function initWorker(id: number, proxy: string): Promise<ProxyWorker> {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_PASSWORD;
  const service = process.env.BLUESKY_SERVICE || 'https://bsky.social';

  if (!handle || !password) {
    throw new Error('Missing BLUESKY_HANDLE or BLUESKY_PASSWORD');
  }

  const agent = new BskyAgent({ 
    service,
    // @ts-ignore - proxy agent works but types don't match perfectly
    fetch: proxy ? (url: string, init: any) => {
      const proxyAgent = new HttpsProxyAgent(proxy);
      return fetch(url, { ...init, agent: proxyAgent });
    } : undefined
  });

  await agent.login({ identifier: handle, password });
  console.log(`✓ Worker ${id} authenticated via ${proxy || 'direct connection'}`);

  return {
    id,
    agent,
    proxy: proxy || 'direct',
    processed: 0,
    errors: 0
  };
}

async function collectEngagementForUser(
  worker: ProxyWorker, 
  did: string, 
  handle: string
): Promise<any> {
  try {
    const feedRes = await worker.agent.getAuthorFeed({ 
      actor: did, 
      limit: POSTS_TO_ANALYZE 
    });

    if (!feedRes || !feedRes.data.feed.length) {
      return null;
    }

    let totalLikes = 0;
    let totalReposts = 0;
    let totalReplies = 0;
    let maxLikes = 0;
    let maxReposts = 0;
    let maxReplies = 0;

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
    }

    const totalPosts = feedRes.data.feed.length;

    worker.processed++;
    return {
      user_did: did,
      total_likes: totalLikes,
      total_reposts: totalReposts,
      total_replies: totalReplies,
      total_posts: totalPosts,
      avg_likes_per_post: totalPosts > 0 ? Math.round((totalLikes / totalPosts) * 100) / 100 : 0,
      avg_reposts_per_post: totalPosts > 0 ? Math.round((totalReposts / totalPosts) * 100) / 100 : 0,
      avg_replies_per_post: totalPosts > 0 ? Math.round((totalReplies / totalPosts) * 100) / 100 : 0,
      max_likes_single_post: maxLikes,
      max_reposts_single_post: maxReposts,
      max_replies_single_post: maxReplies,
      posts_analyzed: totalPosts,
    };
  } catch (error: any) {
    worker.errors++;
    console.error(`❌ Worker ${worker.id} failed for ${handle}:`, error?.message);
    return null;
  }
}

async function saveEngagementMetrics(metrics: any[]) {
  if (metrics.length === 0) return;

  const { error } = await supabase
    .from('engagement_metrics')
    .upsert(
      metrics.map(m => ({
        ...m,
        collection_date: new Date().toISOString(),
      })),
      { onConflict: 'user_did' }
    );

  if (error) throw error;
  console.log(`✓ Saved ${metrics.length} metrics`);
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║        PROXY-ROTATING ENGAGEMENT COLLECTOR                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Initialize workers with proxies (or direct if no proxies)
  const proxiesToUse = PROXY_LIST.length > 0 
    ? PROXY_LIST 
    : Array(CONCURRENT_COLLECTORS).fill('');

  console.log(`Initializing ${proxiesToUse.length} workers...`);
  for (let i = 0; i < proxiesToUse.length; i++) {
    const worker = await initWorker(i + 1, proxiesToUse[i]);
    workers.push(worker);
  }
  console.log();

  // Load users
  console.log('Loading users...');
  const { data: users, error } = await supabase
    .from('bluesky_users')
    .select('did, handle')
    .order('indexed_at', { ascending: true })
    .limit(10000); // Adjust as needed

  if (error || !users) {
    console.error('❌ Failed to load users:', error);
    process.exit(1);
  }

  console.log(`✓ Loaded ${users.length} users\n`);

  const startTime = Date.now();
  const allMetrics: any[] = [];
  let userIndex = 0;

  console.log('🚀 Starting distributed collection...\n');

  // Distribute users across workers in round-robin fashion
  while (userIndex < users.length) {
    const batch: Promise<any>[] = [];

    // Each worker processes one user in parallel
    for (const worker of workers) {
      if (userIndex >= users.length) break;
      
      const user = users[userIndex++];
      batch.push(
        collectEngagementForUser(worker, user.did, user.handle)
          .then(metrics => {
            if (metrics) {
              console.log(`✓ Worker ${worker.id}: @${user.handle} (${worker.processed} total)`);
              return metrics;
            }
            return null;
          })
      );
    }

    const results = await Promise.all(batch);
    const validMetrics = results.filter(m => m !== null);
    allMetrics.push(...validMetrics);

    // Save in batches
    if (allMetrics.length >= USERS_PER_DB_BATCH) {
      await saveEngagementMetrics(allMetrics);
      allMetrics.length = 0;
    }

    // Progress report
    if (userIndex % 50 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = userIndex / elapsed;
      const remaining = (users.length - userIndex) / rate / 60;
      
      console.log(`\n📊 Progress: ${userIndex}/${users.length} (${(userIndex/users.length*100).toFixed(1)}%)`);
      console.log(`   Rate: ${rate.toFixed(1)} users/sec | ETA: ${remaining.toFixed(1)} min`);
      workers.forEach(w => 
        console.log(`   Worker ${w.id} [${w.proxy}]: ${w.processed} processed, ${w.errors} errors`)
      );
      console.log();
    }
  }

  // Save remaining
  if (allMetrics.length > 0) {
    await saveEngagementMetrics(allMetrics);
  }

  const totalTime = (Date.now() - startTime) / 1000 / 60;
  const totalProcessed = workers.reduce((sum, w) => sum + w.processed, 0);
  const totalErrors = workers.reduce((sum, w) => sum + w.errors, 0);

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                  COLLECTION COMPLETE                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  console.log(`✓ Processed: ${totalProcessed} users`);
  console.log(`✓ Time: ${totalTime.toFixed(1)} minutes`);
  console.log(`✓ Throughput: ${(totalProcessed / totalTime).toFixed(1)} users/min`);
  console.log(`❌ Errors: ${totalErrors}\n`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
