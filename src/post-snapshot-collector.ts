import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

interface PostSnapshot {
  uri: string;
  like_count: number;
  repost_count: number;
  reply_count: number;
  quote_count: number;
  total_engagement: number;
  snapshot_at: string;
}

/**
 * Collect snapshot of post engagement metrics
 */
async function collectPostSnapshots() {
  console.log('Starting post snapshots collection...');
  const startTime = Date.now();
  
  try {
    // Fetch posts from the last 7 days with engagement
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: posts, error } = await supabase
      .from('bluesky_posts')
      .select('uri, like_count, repost_count, reply_count, quote_count')
      .gte('created_at', sevenDaysAgo.toISOString())
      .or('like_count.gt.0,repost_count.gt.0,reply_count.gt.0,quote_count.gt.0')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch posts: ${error.message}`);
    }

    if (!posts || posts.length === 0) {
      console.log('No posts found to snapshot');
      return;
    }

    console.log(`Found ${posts.length} posts to snapshot`);

    // Prepare snapshots
    const snapshots: PostSnapshot[] = posts.map(post => ({
      uri: post.uri,
      like_count: post.like_count || 0,
      repost_count: post.repost_count || 0,
      reply_count: post.reply_count || 0,
      quote_count: post.quote_count || 0,
      total_engagement: (post.like_count || 0) + (post.repost_count || 0) + 
                       (post.reply_count || 0) + (post.quote_count || 0),
      snapshot_at: new Date().toISOString()
    }));

    // Insert snapshots in batches
    const batchSize = 1000;
    let inserted = 0;

    for (let i = 0; i < snapshots.length; i += batchSize) {
      const batch = snapshots.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('post_snapshots')
        .insert(batch);

      if (insertError) {
        console.error(`Failed to insert batch ${i / batchSize + 1}:`, insertError.message);
        continue;
      }

      inserted += batch.length;
      console.log(`Inserted ${inserted}/${snapshots.length} snapshots`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✓ Successfully collected ${inserted} post snapshots in ${duration}s`);

    // Refresh materialized views
    console.log('Refreshing materialized views...');
    await refreshMaterializedViews();

  } catch (error) {
    console.error('Error collecting post snapshots:', error);
    throw error;
  }
}

/**
 * Refresh materialized views for analytics
 */
async function refreshMaterializedViews() {
  try {
    const { error } = await supabase.rpc('refresh_analytics_views');
    
    if (error) {
      console.error('Failed to refresh views:', error.message);
      return;
    }

    console.log('✓ Materialized views refreshed');
  } catch (error) {
    console.error('Error refreshing views:', error);
  }
}

/**
 * Clean up old post snapshots (keep last 30 days)
 */
async function cleanupOldPostSnapshots() {
  console.log('Cleaning up old post snapshots...');
  
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error } = await supabase
      .from('post_snapshots')
      .delete()
      .lt('snapshot_at', thirtyDaysAgo.toISOString());

    if (error) {
      console.error('Failed to cleanup post snapshots:', error.message);
      return;
    }

    console.log('✓ Old post snapshots cleaned up');
  } catch (error) {
    console.error('Error cleaning up post snapshots:', error);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await collectPostSnapshots();
    
    // Clean up old snapshots once per day
    const hour = new Date().getHours();
    if (hour === 3) { // Run cleanup at 3 AM
      await cleanupOldPostSnapshots();
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
