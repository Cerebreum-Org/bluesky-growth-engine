import 'dotenv/config';
import { Jetstream } from '@skyware/jetstream';
import WebSocket from 'ws';
import { supabase } from './supabase.js';

/**
 * Jetstream Real-Time Collector
 * 
 * Collects ALL Bluesky activity in real-time:
 * - New users
 * - Posts
 * - Likes
 * - Reposts
 * - Follows
 * 
 * No rate limits, no API calls needed!
 */

const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 10000; // 10 seconds

interface QueuedUser {
  did: string;
  handle?: string;
}

interface QueuedPost {
  uri: string;
  cid: string;
  author_did: string;
  text?: string;
  created_at: string;
  like_count?: number;
  repost_count?: number;
  reply_count?: number;
}

interface QueuedLike {
  uri: string;
  author_did: string;
  subject_uri: string;
  subject_cid: string;
  created_at: string;
}

interface QueuedRepost {
  uri: string;
  author_did: string;
  subject_uri: string;
  subject_cid: string;
  created_at: string;
}

const userQueue: Map<string, QueuedUser> = new Map();
const postQueue: Map<string, QueuedPost> = new Map();
const likeQueue: Map<string, QueuedLike> = new Map();
const repostQueue: Map<string, QueuedRepost> = new Map();

let totalUsers = 0;
let totalPosts = 0;
let totalLikes = 0;
let totalReposts = 0;
let totalEvents = 0;

async function flushUsers() {
  if (userQueue.size === 0) return;

  const users = Array.from(userQueue.values());
  userQueue.clear();

  try {
    const { error } = await supabase
      .from('bluesky_users')
      .upsert(
        users.map(u => ({
          did: u.did,
          handle: u.handle || u.did,
          indexed_at: new Date().toISOString(),
        })),
        { onConflict: 'did', ignoreDuplicates: true }
      );

    if (error) throw error;
    totalUsers += users.length;
    console.log(`✓ Saved ${users.length} users (total: ${totalUsers})`);
  } catch (err) {
    console.error('Failed to save users:', err);
  }
}

async function flushPosts() {
  if (postQueue.size === 0) return;

  const posts = Array.from(postQueue.values());
  postQueue.clear();

  try {
    const { error } = await supabase
      .from('bluesky_posts')
      .upsert(posts, { onConflict: 'uri' });

    if (error) throw error;
    totalPosts += posts.length;
    console.log(`✓ Saved ${posts.length} posts (total: ${totalPosts})`);
  } catch (err) {
    console.error('Failed to save posts:', err);
  }
}

async function flushLikes() {
  if (likeQueue.size === 0) return;

  const likes = Array.from(likeQueue.values());
  likeQueue.clear();

  try {
    const { error } = await supabase
      .from('bluesky_likes')
      .upsert(likes, { onConflict: 'uri' });

    if (error) throw error;
    totalLikes += likes.length;
    console.log(`✓ Saved ${likes.length} likes (total: ${totalLikes})`);
  } catch (err) {
    console.error('Failed to save likes:', err);
  }
}

async function flushReposts() {
  if (repostQueue.size === 0) return;

  const reposts = Array.from(repostQueue.values());
  repostQueue.clear();

  try {
    const { error } = await supabase
      .from('bluesky_reposts')
      .upsert(reposts, { onConflict: 'uri' });

    if (error) throw error;
    totalReposts += reposts.length;
    console.log(`✓ Saved ${reposts.length} reposts (total: ${totalReposts})`);
  } catch (err) {
    console.error('Failed to save reposts:', err);
  }
}

async function flushAll() {
  await Promise.all([
    flushUsers(),
    flushPosts(),
    flushLikes(),
    flushReposts(),
  ]);
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         JETSTREAM REAL-TIME COLLECTOR                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const jetstream = new Jetstream({
    ws: WebSocket,
    wantedCollections: [
      'app.bsky.feed.post',
      'app.bsky.feed.like',
      'app.bsky.feed.repost',
      'app.bsky.graph.follow',
    ],
  });

  // Flush periodically
  setInterval(async () => {
    await flushAll();
    
    console.log('\n📊 Stats:');
    console.log(`   Events processed: ${totalEvents}`);
    console.log(`   Queue sizes: ${userQueue.size} users, ${postQueue.size} posts, ${likeQueue.size} likes, ${repostQueue.size} reposts`);
    console.log();
  }, FLUSH_INTERVAL);

  jetstream.onCreate('app.bsky.feed.post', (event) => {
    totalEvents++;
    
    // Add user
    userQueue.set(event.did, { did: event.did });

    // Add post
    postQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.feed.post/${event.commit.rkey}`,
      cid: event.commit.cid,
      author_did: event.did,
      text: event.commit.record.text,
      created_at: event.commit.record.createdAt,
      like_count: 0,
      repost_count: 0,
      reply_count: 0,
    });

    // Flush if batch full
    if (postQueue.size >= BATCH_SIZE) {
      flushPosts();
    }
  });

  jetstream.onCreate('app.bsky.feed.like', (event) => {
    totalEvents++;
    
    // Add user
    userQueue.set(event.did, { did: event.did });

    // Add like
    likeQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.feed.like/${event.commit.rkey}`,
      author_did: event.did,
      subject_uri: event.commit.record.subject.uri,
      subject_cid: event.commit.record.subject.cid,
      created_at: event.commit.record.createdAt,
    });

    if (likeQueue.size >= BATCH_SIZE) {
      flushLikes();
    }
  });

  jetstream.onCreate('app.bsky.feed.repost', (event) => {
    totalEvents++;
    
    // Add user
    userQueue.set(event.did, { did: event.did });

    // Add repost
    repostQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.feed.repost/${event.commit.rkey}`,
      author_did: event.did,
      subject_uri: event.commit.record.subject.uri,
      subject_cid: event.commit.record.subject.cid,
      created_at: event.commit.record.createdAt,
    });

    if (repostQueue.size >= BATCH_SIZE) {
      flushReposts();
    }
  });

  jetstream.onCreate('app.bsky.graph.follow', (event) => {
    totalEvents++;
    
    // Add both users
    userQueue.set(event.did, { did: event.did });
    userQueue.set(event.commit.record.subject, { did: event.commit.record.subject });

    if (userQueue.size >= BATCH_SIZE) {
      flushUsers();
    }
  });

  jetstream.on('error', (err) => {
    console.error('Jetstream error:', err);
  });

  console.log('🚀 Connected to Jetstream!');
  console.log('📡 Collecting real-time data...\n');

  jetstream.start();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n⏳ Shutting down...');
    await flushAll();
    console.log('✓ All data saved');
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
