
/**
 * ATProto Type Workaround:
 * The @atproto/api package uses strict base types that only include $type.
 * At runtime, jetstream events contain full record structures.
 * We use type assertions to access the expected properties.
 * 
 * TODO: This could be improved by using proper type guards or updating @atproto packages.
 */

import type { PostRecord, LikeRecord, RepostRecord, BlockRecord, ListRecord, ListItemRecord, ProfileRecord, FollowRecord } from "./types/atproto-events";
import 'dotenv/config';
import { Jetstream } from '@skyware/jetstream';
import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';
import {
  extractMentions,
  extractHashtags,
  extractLinks,
  analyzeThreadStructure,
  extractMediaData,
  extractTimePatterns,
  calculateEngagementScore,
  normalizeHandle,
  extractDomain,
  normalizeHashtag
} from './text-processors';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

const BATCH_SIZE = 100;
const FLUSH_INTERVAL = 10000; // 10 seconds

// All existing queues
const userQueue: Map<string, any> = new Map();
const postQueue: Map<string, any> = new Map();
const likeQueue: Map<string, any> = new Map();
const repostQueue: Map<string, any> = new Map();
const quotePostQueue: Map<string, any> = new Map();
const blockQueue: Map<string, any> = new Map();
const listQueue: Map<string, any> = new Map();
const listItemQueue: Map<string, any> = new Map();
const profileQueue: Map<string, any> = new Map();

// NEW ENHANCED QUEUES
const threadQueue: Map<string, any> = new Map();
const mentionQueue: Map<string, any> = new Map();
const hashtagQueue: Map<string, any> = new Map();
const linkQueue: Map<string, any> = new Map();
const mediaQueue: Map<string, any> = new Map();
const activityPatternQueue: Map<string, any> = new Map();

// NEW COLLECTION QUEUES
const feedGeneratorQueue: Map<string, any> = new Map();
const threadgateQueue: Map<string, any> = new Map();
const starterpackQueue: Map<string, any> = new Map();
const labelerServiceQueue: Map<string, any> = new Map();

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

// NEW STATS
let totalThreads = 0;
let totalMentions = 0;
let totalHashtags = 0;
let totalLinks = 0;
let totalMedia = 0;

// NEW COLLECTION COUNTERS
let totalFeedGenerators = 0;
let totalThreadgates = 0;
let totalStarterPacks = 0;
let totalLabelerServices = 0;


// Existing flush functions (keeping them unchanged)
async function flushUsers() {
  if (userQueue.size === 0) return;
  const users = Array.from(userQueue.values());
  userQueue.clear();

  const { error } = await supabase
    .from('bluesky_users')
    .upsert(users, { onConflict: 'did', ignoreDuplicates: true });

  if (!error) {
    totalUsers += users.length;
    console.log(`✓ Users: +${users.length} (${totalUsers} total)`);
  } else {
    console.error('⚠️  Users error:', error.message);
  }
}

async function flushPosts() {
  if (postQueue.size === 0) return;

  try {
    const posts = Array.from(postQueue.values());
    postQueue.clear();

    const { error } = await supabase
      .from('bluesky_posts')
      .upsert(posts, { onConflict: 'uri', ignoreDuplicates: true });

    if (!error) {
      totalPosts += posts.length;
      console.log(`✓ Posts: +${posts.length} (${totalPosts} total)`);
    } else {
      console.error('⚠️  Posts error:', error.message);
    }
  } catch (error) {
    console.error('⚠️  Posts flush error:', error);
  }
}

async function flushLikes() {
  if (likeQueue.size === 0) return;
  const likes = Array.from(likeQueue.values());
  likeQueue.clear();

  const { error } = await supabase
    .from('bluesky_likes')
    .upsert(likes, { onConflict: 'uri', ignoreDuplicates: true });

  if (!error) {
    totalLikes += likes.length;
    console.log(`✓ Likes: +${likes.length} (${totalLikes} total)`);
  } else {
    console.error('⚠️  Likes error:', error.message);
  }
}

async function flushReposts() {
  if (repostQueue.size === 0) return;
  const reposts = Array.from(repostQueue.values());
  repostQueue.clear();

  const { error } = await supabase
    .from('bluesky_reposts')
    .upsert(reposts, { onConflict: 'uri', ignoreDuplicates: true });

  if (!error) {
    totalReposts += reposts.length;
    console.log(`✓ Reposts: +${reposts.length} (${totalReposts} total)`);
  } else {
    console.error('⚠️  Reposts error:', error.message);
  }
}

async function flushBlocks() {
  if (blockQueue.size === 0) return;
  const blocks = Array.from(blockQueue.values());
  blockQueue.clear();

  const { error } = await supabase
    .from('bluesky_blocks')
    .upsert(blocks, { onConflict: 'uri', ignoreDuplicates: true });

  if (!error) {
    totalBlocks += blocks.length;
    console.log(`✓ Blocks: +${blocks.length} (${totalBlocks} total) 🚫`);
  } else {
    console.error('⚠️  Blocks error:', error.message);
  }
}

async function flushLists() {
  if (listQueue.size === 0) return;
  const lists = Array.from(listQueue.values());
  listQueue.clear();

  const { error } = await supabase
    .from('bluesky_lists')
    .upsert(lists, { onConflict: 'uri', ignoreDuplicates: true });

  if (!error) {
    totalLists += lists.length;
    console.log(`✓ Lists: +${lists.length} (${totalLists} total) 📋`);
  } else {
    console.error('⚠️  Lists error:', error.message);
  }
}

async function flushListItems() {
  if (listItemQueue.size === 0) return;
  const listItems = Array.from(listItemQueue.values());
  listItemQueue.clear();

  const { error } = await supabase
    .from('bluesky_list_items')
    .upsert(listItems, { onConflict: 'uri', ignoreDuplicates: true });

  if (!error) {
    totalListItems += listItems.length;
    console.log(`✓ List Items: +${listItems.length} (${totalListItems} total)`);
  } else {
    console.error('⚠️  List Items error:', error.message);
  }
}

// NEW ENHANCED FLUSH FUNCTIONS

async function flushThreads() {
  if (threadQueue.size === 0) return;
  const threads = Array.from(threadQueue.values());
  threadQueue.clear();

  const { error } = await supabase
    .from('bluesky_threads')
    .upsert(threads, { onConflict: 'post_uri', ignoreDuplicates: false });

  if (!error) {
    totalThreads += threads.length;
    console.log(`✓ Threads: +${threads.length} (${totalThreads} total) 🧵`);
  } else {
    console.error('⚠️  Threads error:', error.message);
  }
}

async function flushMentions() {
  if (mentionQueue.size === 0) return;
  const mentions = Array.from(mentionQueue.values());
  mentionQueue.clear();

  const { error } = await supabase
    .from('bluesky_mentions')
    .insert(mentions);

  if (!error) {
    totalMentions += mentions.length;
    console.log(`✓ Mentions: +${mentions.length} (${totalMentions} total) @`);
  } else {
    console.error('⚠️  Mentions error:', error.message);
  }
}

async function flushHashtags() {
  if (hashtagQueue.size === 0) return;
  const hashtags = Array.from(hashtagQueue.values());
  hashtagQueue.clear();

  const { error } = await supabase
    .from('bluesky_hashtags')
    .insert(hashtags);

  if (!error) {
    totalHashtags += hashtags.length;
    console.log(`✓ Hashtags: +${hashtags.length} (${totalHashtags} total) #️⃣`);
  } else {
    console.error('⚠️  Hashtags error:', error.message);
  }
}

async function flushLinks() {
  if (linkQueue.size === 0) return;
  const links = Array.from(linkQueue.values());
  linkQueue.clear();

  const { error } = await supabase
    .from('bluesky_links')
    .insert(links);

  if (!error) {
    totalLinks += links.length;
    console.log(`✓ Links: +${links.length} (${totalLinks} total) 🔗`);
  } else {
    console.error('⚠️  Links error:', error.message);
  }
}

async function flushMedia() {
  if (mediaQueue.size === 0) return;
  const media = Array.from(mediaQueue.values());
  mediaQueue.clear();

  const { error } = await supabase
    .from('bluesky_media')
    .insert(media);

  if (!error) {
    totalMedia += media.length;
    console.log(`✓ Media: +${media.length} (${totalMedia} total) 🖼️`);
  } else {
    console.error('⚠️  Media error:', error.message);
  }
}

async function flushActivityPatterns() {
  if (activityPatternQueue.size === 0) return;
  const patterns = Array.from(activityPatternQueue.values());
  activityPatternQueue.clear();

  const { error } = await supabase
    .from('bluesky_activity_patterns')
    .upsert(patterns, { 
      onConflict: 'author_did,hour_of_day,day_of_week',
      ignoreDuplicates: false 
    });

  if (!error) {
    console.log(`✓ Activity Patterns: +${patterns.length} ⏰`);
  } else {
    console.error('⚠️  Activity Patterns error:', error.message);
  }
}

// Enhanced flush all function


async function flushFeedGenerators() {
  if (feedGeneratorQueue.size === 0) return;
  const rows = Array.from(feedGeneratorQueue.values());
  feedGeneratorQueue.clear();
  const { error } = await supabase.from('bluesky_feed_generators').upsert(rows, { onConflict: 'uri', ignoreDuplicates: false });
  if (error) console.error('feed_generators error', error.message);
}

async function flushThreadgates() {
  if (threadgateQueue.size === 0) return;
  const rows = Array.from(threadgateQueue.values());
  threadgateQueue.clear();
  const { error } = await supabase.from('bluesky_threadgates').upsert(rows, { onConflict: 'post_uri', ignoreDuplicates: false });
  if (error) console.error('threadgates error', error.message);
}

async function flushStarterPacks() {
  if (starterpackQueue.size === 0) return;
  const rows = Array.from(starterpackQueue.values());
  starterpackQueue.clear();
  const { error } = await supabase.from('bluesky_starterpacks').upsert(rows, { onConflict: 'uri', ignoreDuplicates: false });
  if (error) console.error('starterpacks error', error.message);
}

async function flushLabelerServices() {
  if (labelerServiceQueue.size === 0) return;
  const rows = Array.from(labelerServiceQueue.values());
  labelerServiceQueue.clear();
  const { error } = await supabase.from('bluesky_labeler_services').upsert(rows, { onConflict: 'uri', ignoreDuplicates: false });
  if (error) console.error('labeler services error', error.message);
}

async function flushAll() {
  console.log('\n📊 Ultimate Stats:');
  console.log(`   Events: ${totalEvents} | Users: ${totalUsers} | Posts: ${totalPosts}`);
  console.log(`   Likes: ${totalLikes} | Reposts: ${totalReposts} | Quotes: ${totalQuotePosts} 📝`);
  console.log(`   Blocks: ${totalBlocks} 🚫 | Lists: ${totalLists} 📋 | List Items: ${totalListItems}`);
  console.log(`   🆕 Threads: ${totalThreads} 🧵 | Mentions: ${totalMentions} @ | Hashtags: ${totalHashtags} #️⃣`);
  console.log(`   🆕 Links: ${totalLinks} 🔗 | Media: ${totalMedia} 🖼️`);
  console.log(`   Queues: ${userQueue.size}u ${postQueue.size}p ${likeQueue.size}l ${repostQueue.size}r ${quotePostQueue.size}q ${blockQueue.size}b ${listQueue.size}ls ${listItemQueue.size}li`);
  console.log(`   🆕 New Queues: ${threadQueue.size}th ${mentionQueue.size}me ${hashtagQueue.size}ha ${linkQueue.size}li ${mediaQueue.size}md\n`);

  await Promise.all([
    // Existing flushes
    flushUsers(),
    // New collection flushes
    flushFeedGenerators(),
    flushThreadgates(),
    flushStarterPacks(),
    flushLabelerServices(),
    flushPosts(),
    flushLikes(),
    flushReposts(),
    flushBlocks(),
    flushLists(),
    flushListItems(),
    // NEW FLUSHES
    flushThreads(),
    flushMentions(),
    flushHashtags(),
    flushLinks(),
    flushMedia(),
    flushActivityPatterns()
  ]);
}

// Enhanced post processing
function processPostContent(event: any) {
  const postUri = `at://${event.did}/app.bsky.feed.post/${event.commit.rkey}`;
  const record = event.commit.record;
  const createdAt = record.createdAt || new Date().toISOString();
  
  // Extract text content
  const text = record.text || '';
  
  // THREAD ANALYSIS
  const threadData = analyzeThreadStructure(record);
  if (threadData.isReply || threadData.parentUri) {
    threadQueue.set(postUri, {
      post_uri: postUri,
      blocker_did: event.did,
      parent_uri: threadData.parentUri,
      root_uri: threadData.rootUri,
      thread_depth: threadData.replyDepth,
      created_at: createdAt
    });
  }
  
  // MENTIONS EXTRACTION
  const mentions = extractMentions(text);
  mentions.forEach((mention, index) => {
    mentionQueue.set(`${postUri}-mention-${index}`, {
      post_uri: postUri,
      blocker_did: event.did,
      mentioned_handle: mention.handle,
      mentioned_did: null, // Will be resolved later
      position: mention.position,
      created_at: createdAt
    });
  });
  
  // HASHTAGS EXTRACTION
  const hashtags = extractHashtags(text);
  hashtags.forEach((hashtag, index) => {
    hashtagQueue.set(`${postUri}-hashtag-${index}`, {
      post_uri: postUri,
      blocker_did: event.did,
      hashtag: hashtag.hashtag,
      normalized_tag: hashtag.normalized,
      position: hashtag.position,
      created_at: createdAt
    });
  });
  
  // LINKS EXTRACTION
  const links = extractLinks(text);
  links.forEach((link, index) => {
    linkQueue.set(`${postUri}-link-${index}`, {
      post_uri: postUri,
      blocker_did: event.did,
      url: link.url,
      domain: link.domain,
      position: link.position,
      created_at: createdAt
    });
  });
  
  // MEDIA EXTRACTION
  const mediaItems = extractMediaData(record);
  mediaItems.forEach((media, index) => {
    mediaQueue.set(`${postUri}-media-${index}`, {
      post_uri: postUri,
      blocker_did: event.did,
      media_type: media.type,
      media_url: media.url,
      media_cid: media.cid,
      alt_text: media.alt,
      dimensions: media.dimensions ? JSON.stringify(media.dimensions) : null,
      metadata: media.metadata ? JSON.stringify(media.metadata) : null,
      created_at: createdAt
    });
  });
  
  // ACTIVITY PATTERNS
  const timePatterns = extractTimePatterns(createdAt);
  const patternKey = `${event.did}-${timePatterns.hourOfDay}-${timePatterns.dayOfWeek}`;
  
  const existingPattern = activityPatternQueue.get(patternKey) || {
    blocker_did: event.did,
    hour_of_day: timePatterns.hourOfDay,
    day_of_week: timePatterns.dayOfWeek,
    post_count: 0,
    like_count: 0,
    repost_count: 0,
    avg_engagement: 0
  };
  
  existingPattern.post_count += 1;
  activityPatternQueue.set(patternKey, existingPattern);
}

// Initialize Jetstream with enhanced processing
async function startCollector() {
  console.log('🚀 Starting Ultimate Bluesky Collector with ALL enhancements...');
  
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
      'app.bsky.feed.generator',
      'app.bsky.feed.threadgate',
      'app.bsky.graph.starterpack',
      'app.bsky.labeler.service',
    ],
  });

  // ENHANCED POSTS HANDLER
  jetstream.onCreate('app.bsky.feed.post', (event) => {
    totalEvents++;
    userQueue.set(event.did, { did: event.did });
    
    const postData = {
      uri: `at://${event.did}/app.bsky.feed.post/${event.commit.rkey}`,
      cid: event.commit.cid,
      blocker_did: event.did,
      text: (event.commit.record as any).text,
      reply_parent: (event.commit.record as any).reply?.parent?.uri,
      reply_root: (event.commit.record as any).reply?.root?.uri,
      embed: (event.commit.record as any).embed ? JSON.stringify((event.commit.record as any).embed) : null,
      lang: (event.commit.record as any).langs?.[0],
      created_at: (event.commit.record as any).createdAt,
      indexed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    postQueue.set(event.commit.rkey, postData);
    
    // ENHANCED PROCESSING
    processPostContent(event);
  });

  // Keep all existing handlers (likes, reposts, blocks, etc.) unchanged
  jetstream.onCreate('app.bsky.feed.like', (event) => {
    totalEvents++;
    userQueue.set(event.did, { did: event.did });
    likeQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.feed.like/${event.commit.rkey}`,
      blocker_did: event.did,
      subject_uri: (event.commit.record as any).subject.uri,
      subject_cid: (event.commit.record as any).subject.cid,
      created_at: (event.commit.record as any).createdAt,
      indexed_at: new Date().toISOString()
    });
  });

  jetstream.onCreate('app.bsky.feed.repost', (event) => {
    totalEvents++;
    userQueue.set(event.did, { did: event.did });
    repostQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.feed.repost/${event.commit.rkey}`,
      blocker_did: event.did,
      subject_uri: (event.commit.record as any).subject.uri,
      subject_cid: (event.commit.record as any).subject.cid,
      created_at: (event.commit.record as any).createdAt,
      indexed_at: new Date().toISOString()
    });
  });

  jetstream.onCreate('app.bsky.graph.block', (event) => {
    totalEvents++;
    console.log(`🚫 Block detected: ${event.did} → ${(event.commit.record as any).subject}`);
    
    userQueue.set(event.did, { did: event.did });
    userQueue.set((event.commit.record as any).subject, { did: (event.commit.record as any).subject });
    
    blockQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.graph.block/${event.commit.rkey}`,
      blocker_did: event.did,
      blocked_did: (event.commit.record as any).subject,
      created_at: (event.commit.record as any).createdAt,
      indexed_at: new Date().toISOString()
    });
  });

  jetstream.onCreate('app.bsky.graph.list', (event) => {
    totalEvents++;
    console.log(`📋 List created: ${(event.commit.record as any).name}`);
    
    userQueue.set(event.did, { did: event.did });
    
    listQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.graph.list/${event.commit.rkey}`,
      blocker_did: event.did,
      name: (event.commit.record as any).name,
      purpose: (event.commit.record as any).purpose,
      description: (event.commit.record as any).description,
      avatar: (event.commit.record as any).avatar?.ref?.$link,
      created_at: (event.commit.record as any).createdAt,
      indexed_at: new Date().toISOString()
    });
  });

  jetstream.onCreate('app.bsky.graph.listitem', (event) => {
    totalEvents++;
    console.log(`📝 List membership: ${(event.commit.record as any).subject} added to ${(event.commit.record as any).list}`);
    
    userQueue.set(event.did, { did: event.did });
    userQueue.set((event.commit.record as any).subject, { did: (event.commit.record as any).subject });
    
    listItemQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.graph.listitem/${event.commit.rkey}`,
      blocker_did: event.did,
      blocked_did: (event.commit.record as any).subject,
      list_uri: (event.commit.record as any).list,
      created_at: (event.commit.record as any).createdAt,
      indexed_at: new Date().toISOString()
    });
  });

  jetstream.onCreate('app.bsky.actor.profile', (event) => {
    totalEvents++;
    
    profileQueue.set(event.did, {
      did: event.did,
      display_name: (event.commit.record as any).displayName,
      description: (event.commit.record as any).description,
      avatar: (event.commit.record as any).avatar?.ref?.$link,
      banner: (event.commit.record as any).banner?.ref?.$link,
      updated_at: new Date().toISOString()
    });
  });



  // NEW: Feed generator declarations
  jetstream.onCreate('app.bsky.feed.generator', (event) => {
    totalEvents++;
    try {
      const rec: any = (event.commit as any).record || {};
      totalFeedGenerators++;
      feedGeneratorQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.feed.generator/${event.commit.rkey}`,
      owner_did: event.did,
      display_name: rec.displayName,
      description: rec.description,
      avatar_link: rec.avatar?.ref?.$link,
      accepts_interactions: !!rec.acceptsInteractions,
      labels: rec.labels ? JSON.stringify(rec.labels) : null,
      created_at: rec.createdAt,
      indexed_at: new Date().toISOString()
    });
    } catch (e) {
      console.error('feed.generator handler error', e);
    }
  });

  // NEW: Threadgate (reply controls)
  jetstream.onCreate('app.bsky.feed.threadgate', (event) => {
    totalEvents++;
    try {
      const rec: any = (event.commit as any).record || {};
      totalThreadgates++;
      threadgateQueue.set(event.commit.rkey, {
      post_uri: rec.post,
      owner_did: event.did,
      allow: rec.allow ? JSON.stringify(rec.allow) : null,
      created_at: rec.createdAt,
      indexed_at: new Date().toISOString()
    });
    } catch (e) {
      console.error('threadgate handler error', e);
    }
  });

  // NEW: Starter packs
  jetstream.onCreate('app.bsky.graph.starterpack', (event) => {
    totalEvents++;
    try {
      const rec: any = (event.commit as any).record || {};
      totalStarterPacks++;
      starterpackQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.graph.starterpack/${event.commit.rkey}`,
      owner_did: event.did,
      name: rec.name,
      description: rec.description,
      list_uri: rec.list,
      feeds: rec.feeds ? JSON.stringify(rec.feeds) : null,
      joined_week_count: rec.joinedWeekCount || 0,
      joined_all_time_count: rec.joinedAllTimeCount || 0,
      labels: rec.labels ? JSON.stringify(rec.labels) : null,
      created_at: rec.indexedAt || new Date().toISOString(),
      indexed_at: new Date().toISOString()
    });
    } catch (e) {
      console.error('starterpack handler error', e);
    }
  });

  // NEW: Labeler services
  jetstream.onCreate('app.bsky.labeler.service', (event) => {
    totalEvents++;
    try {
      const rec: any = (event.commit as any).record || {};
      totalLabelerServices++;
      labelerServiceQueue.set(event.commit.rkey, {
      uri: `at://${event.did}/app.bsky.labeler.service/${event.commit.rkey}`,
      owner_did: event.did,
      policies: rec.policies ? JSON.stringify(rec.policies) : null,
      created_at: rec.createdAt,
      indexed_at: new Date().toISOString()
    });
    } catch (e) {
      console.error('labeler.service handler error', e);
    }
  });
  // Start the collector
  jetstream.start();
  console.log('✅ Ultimate Collector started with enhanced data processing!');

  // Set up enhanced flush interval
  setInterval(flushAll, FLUSH_INTERVAL);
}

startCollector().catch(console.error);
