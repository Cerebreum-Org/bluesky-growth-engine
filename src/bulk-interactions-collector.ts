import 'dotenv/config';
import { BskyAgent } from '@atproto/api';
import { supabase, type BlueskyUser } from './supabase.js';

/**
 * Bulk Post Interactions Collector
 * 
 * Crawls post interactions (likes, reposts, replies) from ALL users in the database
 * to discover their network and expand the user base.
 */

const POSTS_PER_USER = 10; // Analyze 10 recent posts per user
const BATCH_SIZE = 100; // DB insert batch size
const PARALLEL_USERS = 3; // Process 3 users at once
const PARALLEL_POSTS = 5; // Process 5 posts per user simultaneously

let agent: BskyAgent;
const processedDids = new Set<string>();
const userBatch: BlueskyUser[] = [];
let totalCollected = 0;
let totalUsersProcessed = 0;

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

async function flushUserBatch() {
  if (userBatch.length === 0) return;

  try {
    const batch = [...userBatch];
    userBatch.length = 0;

    const { error } = await supabase
      .from('bluesky_users')
      .upsert(batch, { onConflict: 'did' });

    if (error) throw error;
    totalCollected += batch.length;
    console.log(`✓ Saved batch of ${batch.length} users (Total: ${totalCollected.toLocaleString()})`);
  } catch (e) {
    console.warn('Failed to save user batch:', e);
  }
}

async function saveUser(profile: {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  labels?: unknown;
  associated?: unknown;
  viewer?: {
    muted?: boolean;
    blockedBy?: boolean;
    blocking?: string;
    following?: string;
    followedBy?: string;
  };
  createdAt?: string;
}) {
  if (processedDids.has(profile.did)) return false;
  processedDids.add(profile.did);

  const user: BlueskyUser = {
    did: profile.did,
    handle: profile.handle,
    display_name: profile.displayName,
    description: profile.description,
    avatar: profile.avatar,
    banner: profile.banner,
    followers_count: profile.followersCount,
    following_count: profile.followsCount,
    posts_count: profile.postsCount,
    labels: profile.labels,
    associated: profile.associated,
    viewer_muted: profile.viewer?.muted,
    viewer_blocked_by: profile.viewer?.blockedBy,
    viewer_blocking: !!profile.viewer?.blocking,
    viewer_following: !!profile.viewer?.following,
    viewer_followed_by: !!profile.viewer?.followedBy,
    created_at: profile.createdAt,
    indexed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  userBatch.push(user);

  if (userBatch.length >= BATCH_SIZE) {
    await flushUserBatch();
  }

  return true;
}

async function collectInteractionsForUser(did: string, handle: string) {
  try {
    // Get recent posts from this user
    const feedRes = await agent.getAuthorFeed({
      actor: did,
      limit: POSTS_PER_USER,
    });

    if (feedRes.data.feed.length === 0) return;

    // Process posts in parallel batches
    for (let i = 0; i < feedRes.data.feed.length; i += PARALLEL_POSTS) {
      const batch = feedRes.data.feed.slice(i, i + PARALLEL_POSTS);

      await Promise.all(batch.map(async (feedItem) => {
        const post = feedItem.post;
        const tasks = [];

        // Collect likes
        tasks.push((async () => {
          try {
            const likesRes = await agent.getLikes({
              uri: post.uri,
              limit: 100,
            });

            for (const like of likesRes.data.likes) {
              await saveUser(like.actor);
            }
          } catch (e) {
            // Silently skip errors for individual posts
          }
        })());

        // Collect reposts
        tasks.push((async () => {
          try {
            const repostsRes = await agent.getRepostedBy({
              uri: post.uri,
              limit: 100,
            });

            for (const reposter of repostsRes.data.repostedBy) {
              await saveUser(reposter);
            }
          } catch (e) {
            // Silently skip errors
          }
        })());

        // Collect replies
        tasks.push((async () => {
          try {
            const threadRes = await agent.getPostThread({
              uri: post.uri,
              depth: 1,
            });

            if ('replies' in threadRes.data.thread && threadRes.data.thread.replies) {
              for (const reply of threadRes.data.thread.replies) {
                if ('post' in reply && reply.post) {
                  await saveUser(reply.post.author);
                }
              }
            }
          } catch (e) {
            // Silently skip errors
          }
        })());

        await Promise.all(tasks);
      }));
    }
  } catch (e) {
    // Silently skip users that fail
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   BULK POST INTERACTIONS COLLECTOR                     ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  await initAgent();

  // Load existing users from DB to avoid duplicates
  console.log('Loading existing users to skip duplicates...');
  try {
    let lastIndexedAt: string | null = null;
    const loadBatchSize = 1000;
    while (true) {
      let query = supabase
        .from('bluesky_users')
        .select('did, indexed_at')
        .order('indexed_at', { ascending: true })
        .limit(loadBatchSize);

      if (lastIndexedAt) {
        query = query.gt('indexed_at', lastIndexedAt);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (!data || data.length === 0) break;

      data.forEach(u => processedDids.add(u.did));
      lastIndexedAt = data[data.length - 1].indexed_at;
    }
    console.log(`✓ Loaded ${processedDids.size.toLocaleString()} existing users\n`);
  } catch (e) {
    console.warn('Could not load existing users:', e);
  }

  // Get all users from database to process
  console.log('Loading users to analyze...');
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
    console.log(`✓ Loaded ${allUsers.length.toLocaleString()} users to analyze\n`);
  } catch (e) {
    console.error('Failed to load users:', e);
    process.exit(1);
  }

  console.log(`\n🔥 Starting bulk collection from ${allUsers.length.toLocaleString()} users...`);
  console.log(`   ${POSTS_PER_USER} posts per user, ${PARALLEL_USERS} users in parallel\n`);

  // Process users in parallel batches
  for (let i = 0; i < allUsers.length; i += PARALLEL_USERS) {
    const batch = allUsers.slice(i, i + PARALLEL_USERS);

    await Promise.all(batch.map(async (user) => {
      await collectInteractionsForUser(user.did, user.handle);
      totalUsersProcessed++;
      
      if (totalUsersProcessed % 100 === 0) {
        console.log(`📊 Progress: ${totalUsersProcessed.toLocaleString()}/${allUsers.length.toLocaleString()} users processed, ${totalCollected.toLocaleString()} new users collected`);
      }
    }));
  }

  // Flush remaining batches
  await flushUserBatch();

  console.log(`\n✓ Bulk collection complete!`);
  console.log(`  - Users processed: ${totalUsersProcessed.toLocaleString()}`);
  console.log(`  - New users collected: ${totalCollected.toLocaleString()}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
