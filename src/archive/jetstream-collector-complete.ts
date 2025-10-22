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

// Helper function to extract blob references
function extractBlobRef(blob: any): string | null {
  if (!blob) return null;
  if (typeof blob === "string") return blob;
  if (blob.ref && typeof blob.ref === "string") return blob.ref;
  if (blob.$link && typeof blob.$link === "string") return blob.$link;
  if (blob.cid && typeof blob.cid === "string") return blob.cid;
  return null;
}

const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 10000;

// Expanded queues for all data types
const userQueue: Map<string, any> = new Map();
const postQueue: Map<string, any> = new Map();
const likeQueue: Map<string, any> = new Map();
const repostQueue: Map<string, any> = new Map();
const quotePostQueue: Map<string, any> = new Map();
const blockQueue: Map<string, any> = new Map();        // NEW: Blocks
const listQueue: Map<string, any> = new Map();         // NEW: Lists
const listItemQueue: Map<string, any> = new Map();     // NEW: List membership
const profileQueue: Map<string, any> = new Map();      // NEW: Profile updates

// Enhanced statistics
let totalUsers = 0;
let totalPosts = 0;
let totalLikes = 0;
let totalReposts = 0;
let totalQuotePosts = 0;
let totalBlocks = 0;       // NEW
let totalLists = 0;        // NEW  
let totalListItems = 0;    // NEW
let totalProfiles = 0;     // NEW
let totalEvents = 0;

const quoteCollector = new QuotePostCollector(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

// Existing flush functions...
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
        { onConflict: 'did', ignoreDuplicates: false } // Allow updates for profile changes
      );

    if (!error) {
      totalUsers += users.length;
      console.log(`✓ Saved ${users.length} users (total: ${totalUsers})`);
    }
  } catch (err) {
    console.error('Failed to save users:', err);
  }
}

// NEW: Flush blocks
async function flushBlocks() {
  if (blockQueue.size === 0) return;
  const blocks = Array.from(blockQueue.values());
  blockQueue.clear();

  try {
    // Create blocks table if it doesn't exist (you'll need to add this to your schema)
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

// NEW: Flush lists
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

// NEW: Flush list items
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

// NEW: Flush profile updates
async function flushProfiles() {
  if (profileQueue.size === 0) return;
  const profiles = Array.from(profileQueue.values());
  profileQueue.clear();

  try {
    // This updates user profiles with new data
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

// [Include existing flush functions for posts, likes, reposts, quotes...]

async function flushAll() {
  await Promise.all([
    flushUsers(),
    flushProfiles(),  // NEW
    flushBlocks(),    // NEW
    flushLists(),     // NEW
    flushListItems(), // NEW
    // ... existing flushes
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
      'app.bsky.graph.block',     // NEW: Block relationships
      'app.bsky.graph.list',      // NEW: User lists
      'app.bsky.graph.listitem',  // NEW: List membership
      'app.bsky.actor.profile',   // NEW: Profile updates
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
  }, FLUSH_INTERVAL);

  // NEW: Block events
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

  // NEW: List events
  jetstream.onCreate('app.bsky.graph.list', (event) => {
    totalEvents++;
    userQueue.set(event.did, { did: event.did });
    
    listQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.graph.list/${event.commit.rkey}`,
      creator_did: event.did,
      name: (event.commit.record as any).name,
      description: (event.commit.record as any).description,
      purpose: (event.commit.record as any).purpose, // "app.bsky.graph.defs#modlist" or "app.bsky.graph.defs#curatelist"
      created_at: (event.commit.record as any).createdAt,
      indexed_at: new Date().toISOString(),
    });
    
    console.log(`📋 List created: "${(event.commit.record as any).name}" by ${event.did}`);
  });

  // NEW: List item events
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

  // NEW: Profile update events
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
    
    console.log(`👤 Profile updated: ${event.did} (${(event.commit.record as any).displayName})`);
  });

  // [Include existing event handlers for posts, likes, reposts, follows...]

  console.log('🚀 Connected to Complete Jetstream!');
  console.log('📡 Collecting: Posts, Quotes, Lists, Blocks, Profiles...\n');
  jetstream.start();
}

main().catch(console.error);
