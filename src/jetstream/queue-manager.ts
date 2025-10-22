/**
 * Queue Manager for Jetstream Events
 * 
 * Manages batched writes to Supabase with reliability patterns
 */

import { supabase } from '../supabase-enhanced.js';

const RETRY_ATTEMPTS = 3;

// In-memory queues
export const queues = {
  users: [] as any[],
  posts: [] as any[],
  likes: [] as any[],
  reposts: [] as any[],
  blocks: [] as any[],
  lists: [] as any[],
  listItems: [] as any[],
  threads: [] as any[],
  mentions: [] as any[],
  hashtags: [] as any[],
  links: [] as any[],
  media: [] as any[],
  activityPatterns: [] as any[],
  feedGenerators: [] as any[],
  threadgates: [] as any[],
  starterPacks: [] as any[],
  labelerServices: [] as any[],
  deadLetters: [] as any[],
};

async function upsertWithRetry(table: string, rows: any[], onConflict: string, attempts = RETRY_ATTEMPTS) {
  for (let i = 0; i < attempts; i++) {
    try {
      const { error } = await supabase.from(table).upsert(rows, { onConflict });
      if (error) throw error;
      return;
    } catch (e: any) {
      if (i === attempts - 1) {
        console.error(`Failed to upsert to ${table} after ${attempts} attempts:`, e);
        queues.deadLetters.push(...rows.map(r => ({
          table_name: table,
          data: r,
          error_message: e.message,
          created_at: new Date().toISOString()
        })));
      } else {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
}

export async function flushUsers() {
  if (queues.users.length === 0) return;
  const batch = queues.users.splice(0);
  await upsertWithRetry('bluesky_users', batch, 'did');
}

export async function flushPosts() {
  if (queues.posts.length === 0) return;
  const batch = queues.posts.splice(0);
  await upsertWithRetry('bluesky_posts', batch, 'uri');
}

export async function flushLikes() {
  if (queues.likes.length === 0) return;
  const batch = queues.likes.splice(0);
  await upsertWithRetry('bluesky_likes', batch, 'uri');
}

export async function flushReposts() {
  if (queues.reposts.length === 0) return;
  const batch = queues.reposts.splice(0);
  await upsertWithRetry('bluesky_reposts', batch, 'uri');
}

export async function flushBlocks() {
  if (queues.blocks.length === 0) return;
  const batch = queues.blocks.splice(0);
  await upsertWithRetry('bluesky_blocks', batch, 'uri');
}

export async function flushLists() {
  if (queues.lists.length === 0) return;
  const batch = queues.lists.splice(0);
  await upsertWithRetry('bluesky_lists', batch, 'uri');
}

export async function flushListItems() {
  if (queues.listItems.length === 0) return;
  const batch = queues.listItems.splice(0);
  await upsertWithRetry('bluesky_list_items', batch, 'uri');
}

export async function flushThreads() {
  if (queues.threads.length === 0) return;
  const batch = queues.threads.splice(0);
  await upsertWithRetry('bluesky_threads', batch, 'root_uri,reply_uri');
}

export async function flushMentions() {
  if (queues.mentions.length === 0) return;
  const batch = queues.mentions.splice(0);
  await upsertWithRetry('bluesky_mentions', batch, 'post_uri,mentioned_did');
}

export async function flushHashtags() {
  if (queues.hashtags.length === 0) return;
  const batch = queues.hashtags.splice(0);
  await upsertWithRetry('bluesky_hashtags', batch, 'post_uri,tag');
}

export async function flushLinks() {
  if (queues.links.length === 0) return;
  const batch = queues.links.splice(0);
  await upsertWithRetry('bluesky_links', batch, 'post_uri,url');
}

export async function flushMedia() {
  if (queues.media.length === 0) return;
  const batch = queues.media.splice(0);
  await upsertWithRetry('bluesky_media', batch, 'post_uri,media_url');
}

export async function flushActivityPatterns() {
  if (queues.activityPatterns.length === 0) return;
  const batch = queues.activityPatterns.splice(0);
  await upsertWithRetry('bluesky_activity_patterns', batch, 'author_did,hour_of_day');
}

export async function flushFeedGenerators() {
  if (queues.feedGenerators.length === 0) return;
  const batch = queues.feedGenerators.splice(0);
  await upsertWithRetry('bluesky_feed_generators', batch, 'uri');
}

export async function flushThreadgates() {
  if (queues.threadgates.length === 0) return;
  const batch = queues.threadgates.splice(0);
  await upsertWithRetry('bluesky_threadgates', batch, 'uri');
}

export async function flushStarterPacks() {
  if (queues.starterPacks.length === 0) return;
  const batch = queues.starterPacks.splice(0);
  await upsertWithRetry('bluesky_starterpacks', batch, 'uri');
}

export async function flushLabelerServices() {
  if (queues.labelerServices.length === 0) return;
  const batch = queues.labelerServices.splice(0);
  await upsertWithRetry('bluesky_labeler_services', batch, 'uri');
}

export async function flushDeadLetters() {
  if (queues.deadLetters.length === 0) return;
  const batch = queues.deadLetters.splice(0);
  try {
    await supabase.from('bluesky_dead_letters').insert(batch);
  } catch (e) {
    console.error('Failed to save dead letters:', e);
  }
}

export async function flushAll() {
  await Promise.all([
    flushUsers(),
    flushPosts(),
    flushLikes(),
    flushReposts(),
    flushBlocks(),
    flushLists(),
    flushListItems(),
    flushThreads(),
    flushMentions(),
    flushHashtags(),
    flushLinks(),
    flushMedia(),
    flushActivityPatterns(),
    flushFeedGenerators(),
    flushThreadgates(),
    flushStarterPacks(),
    flushLabelerServices(),
    flushDeadLetters(),
  ]);
}
