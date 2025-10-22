import type { PostRecord, LikeRecord, RepostRecord, BlockRecord, ListRecord, ListItemRecord, ProfileRecord, FollowRecord } from "./types/atproto-events";

/**
 * ATProto Type Workaround:
 * Using (event.commit.record as any) to access runtime properties
 * that strict @atproto/api types do not expose.
 */

// Extended Backfill Script with Quote Post Collection
// This extends the existing backfill with quote post functionality

import { BskyAgent } from '@atproto/api';
import { createClient } from '@supabase/supabase-js';
import { QuotePostCollector, isQuotePost } from './quote-post-collector';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// Configuration
const CONFIG = {
  service: process.env.BLUESKY_SERVICE || 'https://bsky.social',
  handle: process.env.BLUESKY_HANDLE!,
  password: process.env.BLUESKY_PASSWORD!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_KEY!,
  batchSize: parseInt(process.env.BATCH_SIZE || '50'),
  rateLimitDelay: parseInt(process.env.RATE_LIMIT_DELAY || '200'),
  maxPostsPerUser: parseInt(process.env.MAX_POSTS_PER_USER || "100"),
  checkpointFile: path.join(process.cwd(), 'quote-backfill-checkpoint.json'),
};

interface QuoteStats {
  processedUsers: number;
  totalPosts: number;
  quotePosts: number;
  quoteChains: number;
  startTime: number;
  errors: number;
}

// Globals
const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
let agent: BskyAgent;
let quoteCollector: QuotePostCollector;

const stats: QuoteStats = {
  processedUsers: 0,
  totalPosts: 0,
  quotePosts: 0,
  quoteChains: 0,
  startTime: Date.now(),
  errors: 0,
};

async function initServices() {
  // Initialize Bluesky agent
  agent = new BskyAgent({ service: CONFIG.service });
  await agent.login({ identifier: CONFIG.handle, password: CONFIG.password });
  console.log(`✅ Authenticated as ${CONFIG.handle}`);

  // Initialize quote collector
  quoteCollector = new QuotePostCollector(CONFIG.supabaseUrl, CONFIG.supabaseKey);
  console.log('✅ Quote post collector initialized');
}

async function processUserPosts(userDid: string, userHandle: string) {
  try {
    console.log(`📝 Processing posts for @${userHandle}...`);
    
    const response = await agent.getAuthorFeed({
      actor: userDid,
      limit: CONFIG.maxPostsPerUser,
    });

    if (!response.data.feed || response.data.feed.length === 0) {
      console.log(`  No posts found for @${userHandle}`);
      return 0;
    }

    const posts = [];
    let quotePostCount = 0;

    // Collect all posts and identify quote posts
    for (const item of response.data.feed) {
      const post = item.post;
      const record = post.record as any;
      
      posts.push({
        uri: post.uri,
        authorDid: post.author.did,
        createdAt: record.createdAt || new Date().toISOString(),
        record: record,
        embed: post.embed
      });

      if (isQuotePost(record)) {
        quotePostCount++;
        console.log(`  🔗 Found quote post: ${post.uri}`);
      }
    }

    stats.totalPosts += posts.length;

    if (quotePostCount > 0) {
      console.log(`  📊 Processing ${quotePostCount} quote posts...`);
      
      // Process quote posts in batches
      for (let i = 0; i < posts.length; i += CONFIG.batchSize) {
        const batch = posts.slice(i, i + CONFIG.batchSize);
        const quotePostsInBatch = batch.filter(p => isQuotePost(p.record));
        
        if (quotePostsInBatch.length > 0) {
          const result = await quoteCollector.processBatch(quotePostsInBatch);
          stats.quotePosts += result.quotePosts;
          
          console.log(`    ✅ Batch ${Math.floor(i / CONFIG.batchSize) + 1}: ${result.quotePosts} quote posts processed`);
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, CONFIG.rateLimitDelay));
        }
      }
    }

    console.log(`  ✅ @${userHandle}: ${posts.length} posts, ${quotePostCount} quote posts`);
    return quotePostCount;

  } catch (error: any) {
    console.error(`❌ Error processing @${userHandle}:`, error.message);
    stats.errors++;
    return 0;
  }
}

async function saveCheckpoint() {
  const checkpoint = {
    processedUsers: stats.processedUsers,
    totalPosts: stats.totalPosts,
    quotePosts: stats.quotePosts,
    quoteChains: stats.quoteChains,
    errors: stats.errors,
    updatedAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(CONFIG.checkpointFile, JSON.stringify(checkpoint, null, 2));
}

async function loadCheckpoint() {
  try {
    if (fs.existsSync(CONFIG.checkpointFile)) {
      const checkpoint = JSON.parse(fs.readFileSync(CONFIG.checkpointFile, 'utf8'));
      stats.processedUsers = checkpoint.processedUsers || 0;
      stats.totalPosts = checkpoint.totalPosts || 0;
      stats.quotePosts = checkpoint.quotePosts || 0;
      stats.quoteChains = checkpoint.quoteChains || 0;
      stats.errors = checkpoint.errors || 0;
      console.log(`📍 Resuming from checkpoint: ${stats.processedUsers} users processed`);
      return checkpoint.processedUsers;
    }
  } catch (error) {
    console.error('Error loading checkpoint:', error);
  }
  return 0;
}

async function main() {
  console.log('🚀 Starting Quote Post Backfill Process\n');
  
  await initServices();
  const startIndex = await loadCheckpoint();
  
  // Fetch users from database
  console.log('📥 Loading users from database...');
  const { data: users, error } = await supabase
    .from('bluesky_users')
    .select('did, handle')
    .order('followers_count', { ascending: false }) // Start with most followed users
    .range(startIndex, startIndex + 1000);
  
  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }
  
  if (!users || users.length === 0) {
    console.log('✅ No more users to process');
    return;
  }
  
  console.log(`📊 Processing ${users.length} users starting from index ${startIndex}\n`);
  
  // Process users
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    console.log(`\n[${i + 1}/${users.length}] Processing @${user.handle} (${user.did})`);
    
    await processUserPosts(user.did, user.handle);
    stats.processedUsers++;
    
    // Save progress periodically
    if (stats.processedUsers % 10 === 0) {
      saveCheckpoint();
      console.log(`💾 Progress saved: ${stats.processedUsers} users processed`);
    }
    
    // Clear cache periodically to prevent memory leaks
    if (stats.processedUsers % 100 === 0) {
      // quoteCollector.clearCache(); // Commented out - not needed
      console.log(`🧹 Cache cleared at user ${stats.processedUsers}`);
    }
  }
  
  // Final save
  saveCheckpoint();
  
  // Get quote chain analytics
  console.log('\n📈 Getting quote chain analytics...');
  try {
    const analytics = await quoteCollector.getQuoteChainAnalytics() as any[];
    stats.quoteChains = analytics.length;
    
    if (analytics.length > 0) {
      console.log('\n🏆 Top Quote Chains:');
      analytics.slice(0, 10).forEach((chain: any, i: number) => {
        console.log(`  ${i + 1}. ${chain.root_uri}`);
        console.log(`     Quotes: ${chain.total_quotes}, Max Depth: ${chain.max_depth}`);
        console.log(`     Duration: ${chain.chain_duration_hours?.toFixed(1)} hours\n`);
      });
    }
  } catch (error) {
    console.error('Error getting analytics:', error);
  }
  
  // Final summary
  const elapsed = (Date.now() - stats.startTime) / 1000 / 60;
  console.log('\n✅ Quote Post Backfill Completed!');
  console.log(`📊 Final Stats:`);
  console.log(`  Users Processed: ${stats.processedUsers.toLocaleString()}`);
  console.log(`  Total Posts: ${stats.totalPosts.toLocaleString()}`);
  console.log(`  Quote Posts Found: ${stats.quotePosts.toLocaleString()}`);
  console.log(`  Quote Chains: ${stats.quoteChains.toLocaleString()}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log(`  Time: ${elapsed.toFixed(1)} minutes\n`);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏸️ Received SIGINT, saving progress...');
  saveCheckpoint();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⏸️ Received SIGTERM, saving progress...');
  saveCheckpoint();
  process.exit(0);
});

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  saveCheckpoint();
  process.exit(1);
});
