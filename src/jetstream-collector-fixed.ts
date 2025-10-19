import 'dotenv/config';
import { Jetstream } from '@skyware/jetstream';
import WebSocket from 'ws';
import { supabase } from './supabase.js';

const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 10000;

const userQueue: Map<string, any> = new Map();
const postQueue: Map<string, any> = new Map();
const likeQueue: Map<string, any> = new Map();
const repostQueue: Map<string, any> = new Map();

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

    if (!error) {
      totalUsers += users.length;
      console.log(`✓ Saved ${users.length} users (total: ${totalUsers})`);
    }
  } catch (err) {
    console.error('Failed to save users:', err);
  }
}

async function flushPosts() {
  if (postQueue.size === 0) return;
  
  // CRITICAL: Flush users first!
  await flushUsers();
  
  const posts = Array.from(postQueue.values());
  postQueue.clear();

  try {
    const { error } = await supabase
      .from('bluesky_posts')
      .upsert(posts, { onConflict: 'uri', ignoreDuplicates: true });

    if (!error) {
      totalPosts += posts.length;
      console.log(`✓ Saved ${posts.length} posts (total: ${totalPosts})`);
    }
  } catch (err) {
    console.error('Failed to save posts:', err);
  }
}

async function flushLikes() {
  if (likeQueue.size === 0) return;
  
  // CRITICAL: Flush users first!
  await flushUsers();
  
  const likes = Array.from(likeQueue.values());
  likeQueue.clear();

  try {
    const { error } = await supabase
      .from('bluesky_likes')
      .upsert(likes, { onConflict: 'uri', ignoreDuplicates: true });

    if (!error) {
      totalLikes += likes.length;
      console.log(`✓ Saved ${likes.length} likes (total: ${totalLikes})`);
    }
  } catch (err) {
    console.error('Failed to save likes:', err);
  }
}

async function flushReposts() {
  if (repostQueue.size === 0) return;
  
  // CRITICAL: Flush users AND posts first!
  await flushUsers();
  await flushPosts();
  
  const reposts = Array.from(repostQueue.values());
  repostQueue.clear();

  try {
    const { error } = await supabase
      .from('bluesky_reposts')
      .upsert(reposts, { onConflict: 'uri', ignoreDuplicates: true });

    if (!error) {
      totalReposts += reposts.length;
      console.log(`✓ Saved ${reposts.length} reposts (total: ${totalReposts})`);
    }
  } catch (err) {
    console.error('Failed to save reposts:', err);
  }
}

async function flushAll() {
  // Order matters: users → posts → likes/reposts
  await flushUsers();
  await flushPosts();
  await Promise.all([flushLikes(), flushReposts()]);
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         JETSTREAM REAL-TIME COLLECTOR (FIXED)             ║');
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

  setInterval(async () => {
    await flushAll();
    console.log('\n📊 Stats:');
    console.log(`   Events: ${totalEvents} | Users: ${totalUsers} | Posts: ${totalPosts} | Likes: ${totalLikes} | Reposts: ${totalReposts}`);
    console.log(`   Queue sizes: ${userQueue.size}u, ${postQueue.size}p, ${likeQueue.size}l, ${repostQueue.size}r\n`);
  }, FLUSH_INTERVAL);

  jetstream.onCreate('app.bsky.feed.post', (event) => {
    totalEvents++;
    userQueue.set(event.did, { did: event.did });
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
  });

  jetstream.onCreate('app.bsky.feed.like', (event) => {
    totalEvents++;
    userQueue.set(event.did, { did: event.did });
    likeQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.feed.like/${event.commit.rkey}`,
      author_did: event.did,
      subject_uri: event.commit.record.subject.uri,
      subject_cid: event.commit.record.subject.cid,
      created_at: event.commit.record.createdAt,
    });
  });

  jetstream.onCreate('app.bsky.feed.repost', (event) => {
    totalEvents++;
    userQueue.set(event.did, { did: event.did });
    repostQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.feed.repost/${event.commit.rkey}`,
      author_did: event.did,
      subject_uri: event.commit.record.subject.uri,
      subject_cid: event.commit.record.subject.cid,
      created_at: event.commit.record.createdAt,
    });
  });

  jetstream.onCreate('app.bsky.graph.follow', (event) => {
    totalEvents++;
    userQueue.set(event.did, { did: event.did });
    userQueue.set(event.commit.record.subject, { did: event.commit.record.subject });
  });

  jetstream.on('error', (err) => {
    console.error('Jetstream error:', err);
  });

  console.log('🚀 Connected to Jetstream!');
  console.log('📡 Collecting real-time data...\n');
  jetstream.start();

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
