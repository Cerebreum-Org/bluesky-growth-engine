import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

interface UserSnapshot {
  did: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  snapshot_at: string;
}

/**
 * Collect snapshot of all users' follower counts
 */
async function collectUserSnapshots() {
  console.log('Starting user snapshots collection...');
  const startTime = Date.now();
  
  try {
    // Fetch all users with their current counts
    const { data: users, error } = await supabase
      .from('bluesky_users')
      .select('did, followers_count, following_count, posts_count')
      .gt('followers_count', 0) // Only track users with at least 1 follower
      .order('followers_count', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    if (!users || users.length === 0) {
      console.log('No users found to snapshot');
      return;
    }

    console.log(`Found ${users.length} users to snapshot`);

    // Prepare snapshots
    const snapshots: UserSnapshot[] = users.map(user => ({
      did: user.did,
      followers_count: user.followers_count || 0,
      following_count: user.following_count || 0,
      posts_count: user.posts_count || 0,
      snapshot_at: new Date().toISOString()
    }));

    // Insert snapshots in batches
    const batchSize = 1000;
    let inserted = 0;

    for (let i = 0; i < snapshots.length; i += batchSize) {
      const batch = snapshots.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('user_snapshots')
        .insert(batch);

      if (insertError) {
        console.error(`Failed to insert batch ${i / batchSize + 1}:`, insertError.message);
        continue;
      }

      inserted += batch.length;
      console.log(`Inserted ${inserted}/${snapshots.length} snapshots`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✓ Successfully collected ${inserted} user snapshots in ${duration}s`);

    // Refresh materialized views after collecting snapshots
    console.log('Refreshing materialized views...');
    await refreshMaterializedViews();

  } catch (error) {
    console.error('Error collecting user snapshots:', error);
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
 * Clean up old snapshots (keep last 90 days)
 */
async function cleanupOldSnapshots() {
  console.log('Cleaning up old snapshots...');
  
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { error } = await supabase
      .from('user_snapshots')
      .delete()
      .lt('snapshot_at', ninetyDaysAgo.toISOString());

    if (error) {
      console.error('Failed to cleanup snapshots:', error.message);
      return;
    }

    console.log('✓ Old snapshots cleaned up');
  } catch (error) {
    console.error('Error cleaning up snapshots:', error);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await collectUserSnapshots();
    
    // Clean up old snapshots once per day (check if we should run)
    const hour = new Date().getHours();
    if (hour === 3) { // Run cleanup at 3 AM
      await cleanupOldSnapshots();
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
