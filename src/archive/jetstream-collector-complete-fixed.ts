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

// All data queues
const userQueue: Map<string, any> = new Map();
const postQueue: Map<string, any> = new Map();
const likeQueue: Map<string, any> = new Map();
const repostQueue: Map<string, any> = new Map();
const quotePostQueue: Map<string, any> = new Map();
const blockQueue: Map<string, any> = new Map();
const listQueue: Map<string, any> = new Map();
const listItemQueue: Map<string, any> = new Map();
const profileQueue: Map<string, any> = new Map();

// Enhanced statistics
let totalUsers = 0;
let totalPosts = 0;
let totalLikes = 0;
let totalReposts = 0;
let totalQuotePosts = 0;
let totalBlocks = 0;
let totalLists = 0;
let totalListItems = 0;
let totalProfiles = 0;
let totalEvents = 0;

// Helper function to extract blob references
function extractBlobRef(blob: any): string | null {
  if (!blob) return null;
  if (typeof blob === "string") return blob;
  if (blob.ref && typeof blob.ref === "string") return blob.ref;
  if (blob.$link && typeof blob.$link === "string") return blob.$link;
  if (blob.cid && typeof blob.cid === "string") return blob.cid;
  return null;
}

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
          display_name: u.display_name,
          description: u.description,
          avatar: u.avatar,
          indexed_at: new Date().toISOString(),
        })),
        { onConflict: 'did', ignoreDuplicates: false }
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
  await flushUsers(); // Ensure users exist first
  
  const posts = Array.from(postQueue.values());
  postQueue.clear();

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

async function flushQuotePosts() {
  if (quotePostQueue.size === 0) return;
  
  const quotePosts = Array.from(quotePostQueue.values());
  quotePostQueue.clear();

  try {
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

async function flushBlocks() {
  if (blockQueue.size === 0) return;
  const blocks = Array.from(blockQueue.values());
  blockQueue.clear();

  try {
    const { error } = await supabase
      .from('bluesky_blocks')
      .upsert(blocks, { onConflict: 'uri', ignoreDuplicates: true });

    if (!error) {
      totalBlocks += blocks.length;
      console.log(`✓ Saved ${blocks.length} blocks (total: ${totalBlocks})`);
    }
  } catch (err) {
    console.error('Failed to save blocks:', err);
  }
}

async function flushLists() {
  if (listQueue.size === 0) return;
  const lists = Array.from(listQueue.values());
  listQueue.clear();

  try {
    const { error } = await supabase
      .from('bluesky_lists')
      .upsert(lists, { onConflict: 'uri', ignoreDuplicates: false });

    if (!error) {
      totalLists += lists.length;
      console.log(`✓ Saved ${lists.length} lists (total: ${totalLists})`);
    }
  } catch (err) {
    console.error('Failed to save lists:', err);
  }
}

async function flushListItems() {
  if (listItemQueue.size === 0) return;
  const listItems = Array.from(listItemQueue.values());
  listItemQueue.clear();

  try {
    const { error } = await supabase
      .from('bluesky_list_items')
      .upsert(listItems, { onConflict: 'uri', ignoreDuplicates: true });

    if (!error) {
      totalListItems += listItems.length;
      console.log(`✓ Saved ${listItems.length} list items (total: ${totalListItems})`);
    }
  } catch (err) {
    console.error('Failed to save list items:', err);
  }
}

async function flushProfiles() {
  if (profileQueue.size === 0) return;
  const profiles = Array.from(profileQueue.values());
  profileQueue.clear();

  try {
    for (const profile of profiles) {
      await supabase
        .from('bluesky_users')
        .update({
          display_name: profile.displayName,
          description: profile.description,
          avatar: profile.avatar,
          banner: profile.banner,
          updated_at: new Date().toISOString(),
        })
        .eq('did', profile.did);
    }
    
    totalProfiles += profiles.length;
    console.log(`✓ Updated ${profiles.length} profiles (total: ${totalProfiles})`);
  } catch (err) {
    console.error('Failed to update profiles:', err);
  }
}

async function flushAll() {
  await Promise.all([
    flushUsers(),
    flushPosts(),
    flushLikes(), 
    flushReposts(),
    flushQuotePosts(),
    flushProfiles(),
    flushBlocks(),
    flushLists(),
    flushListItems(),
  ]);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║            🌊 Complete Jetstream Collector              ║');
  console.log('║     Posts • Quotes • Lists • Blocks • Profiles          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const jetstream = new Jetstream({
    ws: WebSocket,
    wantedCollections: [
      'app.bsky.feed.post',
      'app.bsky.feed.like',
      'app.bsky.feed.repost',
      'app.bsky.graph.follow',
      'app.bsky.graph.block',
      'app.bsky.graph.list',
      'app.bsky.graph.listitem',
      'app.bsky.actor.profile',
    ],
  });

  setInterval(async () => {
    await flushAll();
    console.log('\n📊 Complete Real-time Stats:');
    console.log(`   Events: ${totalEvents} | Users: ${totalUsers} | Posts: ${totalPosts}`);
    console.log(`   Likes: ${totalLikes} | Reposts: ${totalReposts} | Quotes: ${totalQuotePosts} 📝`);
    console.log(`   Blocks: ${totalBlocks} 🚫 | Lists: ${totalLists} 📋 | List Items: ${totalListItems}`);
    console.log(`   Profile Updates: ${totalProfiles} 👤`);
    console.log(`   Queues: ${userQueue.size}u ${postQueue.size}p ${likeQueue.size}l ${repostQueue.size}r ${quotePostQueue.size}q ${blockQueue.size}b ${listQueue.size}ls ${listItemQueue.size}li ${profileQueue.size}pr\n`);
    
    if (totalEvents % 10000 === 0) {
      quoteCollector.clearCache();
      console.log('🧹 Cleared quote post cache');
    }
  }, FLUSH_INTERVAL);

  // POSTS - Complete handler with quote detection
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
    
    // Check for quote posts
    if (isQuotePost(event.commit.record)) {
      const quotePostData = {
        uri: postData.uri,
        authorDid: event.did,
        createdAt: (event.commit.record as any).createdAt,
        record: event.commit.record,
        embed: null,
      };
      
      quotePostQueue.set(event.commit.rkey, quotePostData);
      console.log(`📝 Quote post detected: ${postData.uri}`);
    }
  });

  // LIKES
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

  // REPOSTS
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

  // FOLLOWS
  jetstream.onCreate('app.bsky.graph.follow', (event) => {
    totalEvents++;
    userQueue.set(event.did, { did: event.did });
    userQueue.set((event.commit.record as any).subject, { did: (event.commit.record as any).subject });
  });

  // BLOCKS
  jetstream.onCreate('app.bsky.graph.block', (event) => {
    totalEvents++;
    userQueue.set(event.did, { did: event.did });
    userQueue.set((event.commit.record as any).subject, { did: (event.commit.record as any).subject });
    
    blockQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.graph.block/${event.commit.rkey}`,
      blocker_did: event.did,
      blocked_did: (event.commit.record as any).subject,
      created_at: (event.commit.record as any).createdAt,
      indexed_at: new Date().toISOString(),
    });
    
    console.log(`🚫 Block detected: ${event.did} → ${(event.commit.record as any).subject}`);
  });

  // LISTS
  jetstream.onCreate('app.bsky.graph.list', (event) => {
    totalEvents++;
    userQueue.set(event.did, { did: event.did });
    
    listQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.graph.list/${event.commit.rkey}`,
      creator_did: event.did,
      name: (event.commit.record as any).name,
      description: (event.commit.record as any).description,
      purpose: (event.commit.record as any).purpose,
      created_at: (event.commit.record as any).createdAt,
      indexed_at: new Date().toISOString(),
    });
    
    console.log(`📋 List created: "${(event.commit.record as any).name}" by ${event.did}`);
  });

  // LIST ITEMS
  jetstream.onCreate('app.bsky.graph.listitem', (event) => {
    totalEvents++;
    userQueue.set(event.did, { did: event.did });
    userQueue.set((event.commit.record as any).subject, { did: (event.commit.record as any).subject });
    
    listItemQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.graph.listitem/${event.commit.rkey}`,
      list_uri: (event.commit.record as any).list,
      subject_did: (event.commit.record as any).subject,
      created_at: (event.commit.record as any).createdAt,
      indexed_at: new Date().toISOString(),
    });
    
    console.log(`📝 List membership: ${(event.commit.record as any).subject} added to ${(event.commit.record as any).list}`);
  });

  // PROFILES
  jetstream.onCreate('app.bsky.actor.profile', (event) => {
    totalEvents++;
    
    profileQueue.set(event.did, {
      did: event.did,
      displayName: (event.commit.record as any).displayName,
      description: (event.commit.record as any).description,
      avatar: extractBlobRef((event.commit.record as any).avatar),
      banner: extractBlobRef((event.commit.record as any).banner),
      updated_at: new Date().toISOString(),
    });
    
    console.log(`👤 Profile updated: ${event.did} (${(event.commit.record as any).displayName || ''})`);
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

  console.log('🚀 Connected to Complete Jetstream!');
  console.log('📡 Collecting: Posts, Quotes, Lists, Blocks, Profiles...\n');
  jetstream.start();
}

main().catch(console.error);
