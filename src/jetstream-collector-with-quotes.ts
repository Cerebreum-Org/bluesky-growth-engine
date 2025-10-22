import type { PostRecord, LikeRecord, RepostRecord, BlockRecord, ListRecord, ListItemRecord, ProfileRecord, FollowRecord } from "./types/atproto-events";

/**
 * ATProto Type Workaround:
 * Using (event.commit.record as any) to access runtime properties
 * that strict @atproto/api types do not expose.
 */

import 'dotenv/config';
import { Jetstream } from '@skyware/jetstream';
import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';
import { QuotePostCollector, isQuotePost } from './quote-post-collector';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 10000;

// Queues for batch processing
const userQueue: Map<string, any> = new Map();
const postQueue: Map<string, any> = new Map();
const likeQueue: Map<string, any> = new Map();
const repostQueue: Map<string, any> = new Map();
const quotePostQueue: Map<string, any> = new Map(); // NEW: Queue for quote posts

// Statistics
let totalUsers = 0;
let totalPosts = 0;
let totalLikes = 0;
let totalReposts = 0;
let totalQuotePosts = 0; // NEW: Quote post counter
let totalEvents = 0;

// Initialize quote post collector
const quoteCollector = new QuotePostCollector(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

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

  // Remove duplicates by URI
  const uniquePosts = posts.reduce((acc, post) => {
    acc[post.uri] = post;
    return acc;
  }, {} as Record<string, any>);

  try {
    const { error } = await supabase
      .from('bluesky_posts')
      .upsert(Object.values(uniquePosts), { onConflict: 'uri', ignoreDuplicates: true });

    if (!error) {
      totalPosts += Object.keys(uniquePosts).length;
      console.log(`✓ Saved ${Object.keys(uniquePosts).length} posts (total: ${totalPosts})`);
    }
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

// NEW: Flush quote posts
async function flushQuotePosts() {
  if (quotePostQueue.size === 0) return;
  
  const quotePosts = Array.from(quotePostQueue.values());
  quotePostQueue.clear();

  try {
    // Process quote posts in smaller batches to avoid overwhelming the system
    const batchSize = 20;
    for (let i = 0; i < quotePosts.length; i += batchSize) {
      const batch = quotePosts.slice(i, i + batchSize);
      const result = await quoteCollector.processBatch(batch);
      totalQuotePosts += result.quotePosts;
      
      if (result.quotePosts > 0) {
        console.log(`✓ Processed ${result.quotePosts} quote posts (total: ${totalQuotePosts})`);
      }
    }
  } catch (err) {
    console.error('Failed to process quote posts:', err);
  }
}

async function flushAll() {
  await Promise.all([
    flushUsers(),
    flushPosts(),
    flushLikes(), 
    flushReposts(),
    flushQuotePosts(), // NEW: Flush quote posts
  ]);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║              🌊 Jetstream + Quote Posts Collector       ║');
  console.log('║                Real-time Bluesky Data Collection         ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

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
    console.log('\n📊 Real-time Stats:');
    console.log(`   Events: ${totalEvents} | Users: ${totalUsers} | Posts: ${totalPosts} | Likes: ${totalLikes}`);
    console.log(`   Reposts: ${totalReposts} | Quote Posts: ${totalQuotePosts} 📝`);
    console.log(`   Queue sizes: ${userQueue.size}u, ${postQueue.size}p, ${likeQueue.size}l, ${repostQueue.size}r, ${quotePostQueue.size}q\n`);
    
    // Clear quote collector cache periodically to prevent memory leaks
    if (totalEvents % 10000 === 0) {
      quoteCollector.clearCache();
      console.log('🧹 Cleared quote post cache');
    }
  }, FLUSH_INTERVAL);

  jetstream.onCreate('app.bsky.feed.post', (event) => {
    totalEvents++;
    userQueue.set(event.did, { did: event.did });
    
    const postData = {
      uri: `at://${event.did}/app.bsky.feed.post/${event.commit.rkey}`,
      cid: event.commit.cid,
      author_did: event.did,
      text: (event.commit.record as any).text || '',
      created_at: (event.commit.record as any).createdAt,
      reply_parent: (event.commit.record as any).reply?.parent?.uri || null,
      reply_root: (event.commit.record as any).reply?.root?.uri || null,
      like_count: 0,
      repost_count: 0,
      reply_count: 0,
      indexed_at: new Date().toISOString(),
    };
    
    postQueue.set(event.commit.rkey, postData);
    
    // NEW: Check if this is a quote post
    if (isQuotePost(event.commit.record)) {
      const quotePostData = {
        uri: postData.uri,
        authorDid: event.did,
        createdAt: (event.commit.record as any).createdAt,
        record: event.commit.record,
        embed: null, // Jetstream doesn't provide embed data, but we can still detect quotes
      };
      
      quotePostQueue.set(event.commit.rkey, quotePostData);
      console.log(`📝 Quote post detected: ${postData.uri}`);
    }
  });

  jetstream.onCreate('app.bsky.feed.like', (event) => {
    totalEvents++;
    userQueue.set(event.did, { did: event.did });
    likeQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.feed.like/${event.commit.rkey}`,
      author_did: event.did,
      subject_uri: (event.commit.record as any).subject.uri,
      subject_cid: (event.commit.record as any).subject.cid,
      created_at: (event.commit.record as any).createdAt,
    });
  });

  jetstream.onCreate('app.bsky.feed.repost', (event) => {
    totalEvents++;
    userQueue.set(event.did, { did: event.did });
    repostQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.feed.repost/${event.commit.rkey}`,
      author_did: event.did,
      subject_uri: (event.commit.record as any).subject.uri,
      subject_cid: (event.commit.record as any).subject.cid,
      created_at: (event.commit.record as any).createdAt,
    });
  });

  jetstream.onCreate('app.bsky.graph.follow', (event) => {
    totalEvents++;
    userQueue.set(event.did, { did: event.did });
    userQueue.set((event.commit.record as any).subject, { did: (event.commit.record as any).subject });
  });

  jetstream.on('error', (err) => {
    console.error('Jetstream error:', err);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n⏸️ Shutting down gracefully...');
    await flushAll();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n⏸️ Shutting down gracefully...');
    await flushAll();
    process.exit(0);
  });

  console.log('🚀 Connected to Jetstream with Quote Post Detection!');
  console.log('📡 Collecting real-time data including quote posts...\n');
  jetstream.start();
}

main().catch(console.error);
