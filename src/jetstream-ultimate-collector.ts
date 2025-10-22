import 'dotenv/config';
/**
 * Jetstream Ultimate Collector - Refactored
 * 
 * Real-time collection from Bluesky firehose
 * Now using modularized queue management
 */

import { Jetstream } from '@skyware/jetstream';
import WebSocket from 'ws';
import { queues, flushAll } from './jetstream/queue-manager.js';

const FLUSH_INTERVAL = 5000; // 5 seconds
const BATCH_SIZE = 500;

const collections = [
  'app.bsky.feed.post',
  'app.bsky.feed.like',
  'app.bsky.feed.repost',
  'app.bsky.graph.follow',
  'app.bsky.graph.block',
  'app.bsky.graph.list',
  'app.bsky.graph.listitem',
  'app.bsky.feed.generator',
  'app.bsky.feed.threadgate',
  'app.bsky.graph.starterpack',
  'app.bsky.labeler.service',
];

let eventCount = 0;
let lastFlushTime = Date.now();

function shouldFlush(): boolean {
  const queueSize = Object.values(queues).reduce((sum, q) => sum + q.length, 0);
  const timeSinceFlush = Date.now() - lastFlushTime;
  return queueSize >= BATCH_SIZE || timeSinceFlush >= FLUSH_INTERVAL;
}

async function handleCommit(event: any) {
  eventCount++;
  
  try {
    // Queue user
    queues.users.push({
      did: event.did,
      handle: null,
      display_name: null,
      avatar_url: null,
      indexed_at: new Date().toISOString(),
    });

    const collection = event.commit?.collection;
    const record = event.commit?.record;
    const rkey = event.commit?.rkey;
    
    if (!collection || !record || !rkey) return;

    const uri = `at://${event.did}/${collection}/${rkey}`;
    const createdAt = record.createdAt || new Date().toISOString();

    // Route to appropriate handler
    switch (collection) {
      case 'app.bsky.feed.post':
        handlePost(event, uri, record, createdAt);
        break;
      case 'app.bsky.feed.like':
        handleLike(event, uri, record, createdAt);
        break;
      case 'app.bsky.feed.repost':
        handleRepost(event, uri, record, createdAt);
        break;
      case 'app.bsky.graph.block':
        handleBlock(event, uri, record, createdAt);
        break;
      case 'app.bsky.graph.list':
        handleList(event, uri, record, createdAt);
        break;
      case 'app.bsky.graph.listitem':
        handleListItem(event, uri, record, createdAt);
        break;
      case 'app.bsky.feed.generator':
        handleFeedGenerator(event, uri, record, createdAt);
        break;
      case 'app.bsky.feed.threadgate':
        handleThreadgate(event, uri, record, createdAt);
        break;
      case 'app.bsky.graph.starterpack':
        handleStarterPack(event, uri, record, createdAt);
        break;
      case 'app.bsky.labeler.service':
        handleLabelerService(event, uri, record, createdAt);
        break;
    }

    // Auto-flush when needed
    if (shouldFlush()) {
      await flushAll();
      lastFlushTime = Date.now();
      console.log(`Flushed at ${eventCount} events`);
    }
  } catch (error) {
    console.error('Error handling commit:', error);
  }
}

function handlePost(event: any, uri: string, record: any, createdAt: string) {
  queues.posts.push({
    uri,
    cid: event.commit.cid,
    author_did: event.did,
    text: record.text || '',
    created_at: createdAt,
    reply_parent: record.reply?.parent?.uri || null,
    reply_root: record.reply?.root?.uri || null,
    embed_type: record.embed?.$type || null,
    like_count: 0,
    repost_count: 0,
    reply_count: 0,
    quote_count: 0,
    indexed_at: new Date().toISOString(),
  });

  // Extract enrichment data
  processPostContent(event.did, uri, record, createdAt);
}

function handleLike(event: any, uri: string, record: any, createdAt: string) {
  queues.likes.push({
    uri,
    author_did: event.did,
    subject_uri: record.subject?.uri || null,
    subject_cid: record.subject?.cid || null,
    created_at: createdAt,
    indexed_at: new Date().toISOString(),
  });
}

function handleRepost(event: any, uri: string, record: any, createdAt: string) {
  queues.reposts.push({
    uri,
    author_did: event.did,
    subject_uri: record.subject?.uri || null,
    subject_cid: record.subject?.cid || null,
    created_at: createdAt,
    indexed_at: new Date().toISOString(),
  });
}

function handleBlock(event: any, uri: string, record: any, createdAt: string) {
  queues.blocks.push({
    uri,
    author_did: event.did,
    subject_did: record.subject || null,
    created_at: createdAt,
    indexed_at: new Date().toISOString(),
  });
}

function handleList(event: any, uri: string, record: any, createdAt: string) {
  queues.lists.push({
    uri,
    author_did: event.did,
    name: record.name || null,
    purpose: record.purpose || null,
    description: record.description || null,
    created_at: createdAt,
    indexed_at: new Date().toISOString(),
  });
}

function handleListItem(event: any, uri: string, record: any, createdAt: string) {
  queues.listItems.push({
    uri,
    list_uri: record.list || null,
    subject_did: record.subject || null,
    created_at: createdAt,
    indexed_at: new Date().toISOString(),
  });
}

function handleFeedGenerator(event: any, uri: string, record: any, createdAt: string) {
  queues.feedGenerators.push({
    uri,
    author_did: event.did,
    display_name: record.displayName || null,
    description: record.description || null,
    created_at: createdAt,
    indexed_at: new Date().toISOString(),
  });
}

function handleThreadgate(event: any, uri: string, record: any, createdAt: string) {
  queues.threadgates.push({
    uri,
    post_uri: record.post || null,
    allow: record.allow ? JSON.stringify(record.allow) : null,
    created_at: createdAt,
    indexed_at: new Date().toISOString(),
  });
}

function handleStarterPack(event: any, uri: string, record: any, createdAt: string) {
  queues.starterPacks.push({
    uri,
    author_did: event.did,
    name: record.name || null,
    description: record.description || null,
    created_at: createdAt,
    indexed_at: new Date().toISOString(),
  });
}

function handleLabelerService(event: any, uri: string, record: any, createdAt: string) {
  queues.labelerServices.push({
    uri,
    author_did: event.did,
    created_at: createdAt,
    indexed_at: new Date().toISOString(),
  });
}

function processPostContent(authorDid: string, postUri: string, record: any, createdAt: string) {
  const text = record.text || '';
  
  // Extract threads
  if (record.reply) {
    queues.threads.push({
      root_uri: record.reply.root?.uri || null,
      reply_uri: postUri,
      parent_uri: record.reply.parent?.uri || null,
      author_did: authorDid,
      created_at: createdAt,
    });
  }

  // Extract mentions
  if (record.facets) {
    record.facets.forEach((facet: any) => {
      facet.features?.forEach((feature: any) => {
        if (feature.$type === 'app.bsky.richtext.facet#mention' && feature.did) {
          queues.mentions.push({
            post_uri: postUri,
            mentioned_did: feature.did,
            author_did: authorDid,
            created_at: createdAt,
          });
        }
      });
    });
  }

  // Extract hashtags (simple regex)
  const hashtagMatches = text.match(/#\w+/g);
  if (hashtagMatches) {
    hashtagMatches.forEach(tag => {
      queues.hashtags.push({
        post_uri: postUri,
        tag: tag,
        author_did: authorDid,
        created_at: createdAt,
      });
    });
  }

  // Extract links (simple regex)
  const linkMatches = text.match(/https?:\/\/[^\s]+/g);
  if (linkMatches) {
    linkMatches.forEach(url => {
      queues.links.push({
        post_uri: postUri,
        url: url,
        author_did: authorDid,
        created_at: createdAt,
      });
    });
  }

  // Extract media
  if (record.embed?.images) {
    record.embed.images.forEach((img: any) => {
      queues.media.push({
        post_uri: postUri,
        media_type: 'image',
        media_url: img.image?.ref?.$link || null,
        alt_text: img.alt || null,
        author_did: authorDid,
        created_at: createdAt,
      });
    });
  }

  // Activity patterns
  const hour = new Date(createdAt).getUTCHours();
  queues.activityPatterns.push({
    author_did: authorDid,
    hour_of_day: hour,
    post_count: 1,
    created_at: createdAt,
  });
}

async function startCollector() {
  console.log('Starting Jetstream Ultimate Collector...');
  
  const jetstream = new Jetstream({
    ws: WebSocket,
    wantedCollections: collections,
  });

  jetstream.on('open', () => {
    console.log('✓ Connected to Jetstream');
  });

  jetstream.on('close', () => {
    console.log('Disconnected from Jetstream');
  });

  jetstream.on('error', (error) => {
    console.error('Jetstream error:', error);
  });

  jetstream.onCreate('app.bsky.feed.post', handleCommit);
  jetstream.onCreate('app.bsky.feed.like', handleCommit);
  jetstream.onCreate('app.bsky.feed.repost', handleCommit);
  jetstream.onCreate('app.bsky.graph.follow', handleCommit);
  jetstream.onCreate('app.bsky.graph.block', handleCommit);
  jetstream.onCreate('app.bsky.graph.list', handleCommit);
  jetstream.onCreate('app.bsky.graph.listitem', handleCommit);
  jetstream.onCreate('app.bsky.feed.generator', handleCommit);
  jetstream.onCreate('app.bsky.feed.threadgate', handleCommit);
  jetstream.onCreate('app.bsky.graph.starterpack', handleCommit);
  jetstream.onCreate('app.bsky.labeler.service', handleCommit);

  jetstream.start();

  // Periodic flush
  setInterval(async () => {
    await flushAll();
    lastFlushTime = Date.now();
    console.log(`Periodic flush at ${eventCount} events`);
  }, FLUSH_INTERVAL);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await flushAll();
    process.exit(0);
  });
}

startCollector().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
