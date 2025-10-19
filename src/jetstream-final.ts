import 'dotenv/config';
import { Jetstream } from '@skyware/jetstream';
import WebSocket from 'ws';
import { supabase } from './supabase.js';

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
  const count = users.length;
  userQueue.clear();

  const { error } = await supabase
    .from('bluesky_users')
    .upsert(users, { onConflict: 'did', ignoreDuplicates: true });

  if (!error) {
    totalUsers += count;
    console.log(`✓ Users: +${count} (${totalUsers} total)`);
  } else {
    console.error('⚠️  Users error:', error.message);
  }
}

async function flushPosts() {
  if (postQueue.size === 0) return;
  await flushUsers(); // Flush users first
  
  const posts = Array.from(postQueue.values());
  const count = posts.length;
  postQueue.clear();

  const { error } = await supabase
    .from('bluesky_posts')
    .upsert(posts, { onConflict: 'uri', ignoreDuplicates: true });

  if (!error) {
    totalPosts += count;
    console.log(`✓ Posts: +${count} (${totalPosts} total)`);
  } else {
    console.error('⚠️  Posts error:', error.message);
  }
}

async function flushLikes() {
  if (likeQueue.size === 0) return;
  await flushUsers(); // Flush users first
  
  const likes = Array.from(likeQueue.values());
  const count = likes.length;
  likeQueue.clear();

  const { error } = await supabase
    .from('bluesky_likes')
    .upsert(likes, { onConflict: 'uri', ignoreDuplicates: true });

  if (!error) {
    totalLikes += count;
    console.log(`✓ Likes: +${count} (${totalLikes} total)`);
  } else {
    console.error('⚠️  Likes error:', error.message);
  }
}

async function flushReposts() {
  if (repostQueue.size === 0) return;
  await flushUsers(); // Flush users first
  
  const reposts = Array.from(repostQueue.values());
  const count = reposts.length;
  repostQueue.clear();

  const { error } = await supabase
    .from('bluesky_reposts')
    .upsert(reposts, { onConflict: 'uri', ignoreDuplicates: true });

  if (!error) {
    totalReposts += count;
    console.log(`✓ Reposts: +${count} (${totalReposts} total)`);
  } else {
    console.error('⚠️  Reposts error:', error.message);
  }
}

async function flushAll() {
  await flushUsers();
  await flushPosts();
  await Promise.all([flushLikes(), flushReposts()]);
}

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║        JETSTREAM COLLECTOR (NO FK VALIDATION)             ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const jetstream = new Jetstream({ 
  ws: WebSocket, 
  wantedCollections: [
    'app.bsky.feed.post', 
    'app.bsky.feed.like', 
    'app.bsky.feed.repost', 
    'app.bsky.graph.follow'
  ] 
});

jetstream.onCreate('app.bsky.feed.post', (event) => {
  const did = event.did;
  userQueue.set(did, { 
    did, 
    handle: event.commit.record.text?.substring(0, 50) || 'unknown', 
    indexed_at: new Date().toISOString(), 
    updated_at: new Date().toISOString() 
  });
  
  postQueue.set(event.commit.rkey, { 
    uri: `at://${did}/app.bsky.feed.post/${event.commit.rkey}`, 
    cid: event.commit.cid, 
    author_did: did, 
    text: event.commit.record.text || '', 
    created_at: event.commit.record.createdAt, 
    reply_count: 0, 
    repost_count: 0, 
    like_count: 0, 
    quote_count: 0 
  });
  
  totalEvents++;
});

jetstream.onCreate('app.bsky.feed.like', (event) => {
  const did = event.did;
  userQueue.set(did, { 
    did, 
    handle: 'unknown', 
    indexed_at: new Date().toISOString(), 
    updated_at: new Date().toISOString() 
  });
  
  likeQueue.set(event.commit.rkey, { 
    uri: `at://${did}/app.bsky.feed.like/${event.commit.rkey}`, 
    author_did: did, 
    subject_uri: event.commit.record.subject.uri, 
    subject_cid: event.commit.record.subject.cid, 
    created_at: event.commit.record.createdAt 
  });
  
  totalEvents++;
});

jetstream.onCreate('app.bsky.feed.repost', (event) => {
  const did = event.did;
  userQueue.set(did, { 
    did, 
    handle: 'unknown', 
    indexed_at: new Date().toISOString(), 
    updated_at: new Date().toISOString() 
  });
  
  repostQueue.set(event.commit.rkey, { 
    uri: `at://${did}/app.bsky.feed.repost/${event.commit.rkey}`, 
    author_did: did, 
    subject_uri: event.commit.record.subject.uri, 
    subject_cid: event.commit.record.subject.cid, 
    created_at: event.commit.record.createdAt 
  });
  
  totalEvents++;
});

jetstream.onCreate('app.bsky.graph.follow', (event) => {
  const follower_did = event.did;
  const following_did = event.commit.record.subject;
  
  userQueue.set(follower_did, { 
    did: follower_did, 
    handle: 'unknown', 
    indexed_at: new Date().toISOString(), 
    updated_at: new Date().toISOString() 
  });
  
  userQueue.set(following_did, { 
    did: following_did, 
    handle: 'unknown', 
    indexed_at: new Date().toISOString(), 
    updated_at: new Date().toISOString() 
  });
  
  totalEvents++;
});

setInterval(() => {
  console.log(`\n📊 ${totalEvents} events | ${totalUsers}u ${totalPosts}p ${totalLikes}l ${totalReposts}r | Queue: ${userQueue.size}u ${postQueue.size}p ${likeQueue.size}l ${repostQueue.size}r\n`);
}, FLUSH_INTERVAL);

setInterval(flushAll, FLUSH_INTERVAL);

process.on('SIGINT', async () => {
  console.log('\n⏳ Saving final batch...');
  await flushAll();
  console.log('✅ Done!');
  process.exit(0);
});

await jetstream.start();
console.log('🚀 Connected to Jetstream!\n');
