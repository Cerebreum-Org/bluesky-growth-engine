import 'dotenv/config';
import { supabase } from './supabase.js';

/**
 * Check Social Graph Backfill Progress
 * 
 * Shows current state of data collection and estimates completion time
 */

async function checkProgress() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║          SOCIAL GRAPH BACKFILL PROGRESS               ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Get total users
  const { count: totalUsers } = await supabase
    .from('bluesky_users')
    .select('*', { count: 'exact' }).limit(1);

  // Get posts count
  const { count: totalPosts } = await supabase
    .from('bluesky_posts')
    .select('*', { count: 'exact' }).limit(1);

  // Get follows count
  const { count: totalFollows } = await supabase
    .from('bluesky_follows')
    .select('*', { count: 'exact' }).limit(1);

  // Get likes count
  const { count: totalLikes } = await supabase
    .from('bluesky_likes')
    .select('*', { count: 'exact' }).limit(1);

  // Get reposts count
  const { count: totalReposts } = await supabase
    .from('bluesky_reposts')
    .select('*', { count: 'exact' }).limit(1);

  // Get unique authors with posts (users processed)
  const { data: authorsData } = await supabase
    .from('bluesky_posts')
    .select('author_did')
    .limit(1000000);

  const uniqueAuthors = new Set(authorsData?.map(p => p.author_did) || []);
  const processedUsers = uniqueAuthors.size;

  console.log('Database Statistics:');
  console.log('═════════════════════════════════════════════════════');
  console.log(`Total Users in DB:        ${(totalUsers || 0).toLocaleString()}`);
  console.log(`Users with Posts:         ${processedUsers.toLocaleString()}`);
  console.log(`Total Posts:              ${(totalPosts || 0).toLocaleString()}`);
  console.log(`Total Follows:            ${(totalFollows || 0).toLocaleString()}`);
  console.log(`Total Likes:              ${(totalLikes || 0).toLocaleString()}`);
  console.log(`Total Reposts:            ${(totalReposts || 0).toLocaleString()}\n`);

  // Calculate progress
  const percentComplete = totalUsers ? (processedUsers / totalUsers * 100).toFixed(2) : '0.00';
  const avgPostsPerUser = processedUsers > 0 ? (totalPosts || 0) / processedUsers : 0;
  const avgFollowsPerUser = totalUsers ? (totalFollows || 0) / totalUsers : 0;

  console.log('Progress:');
  console.log('═════════════════════════════════════════════════════');
  console.log(`Completion:               ${percentComplete}%`);
  console.log(`Avg Posts/User:           ${avgPostsPerUser.toFixed(1)}`);
  console.log(`Avg Follows/User:         ${avgFollowsPerUser.toFixed(1)}\n`);

  // Estimate remaining time
  if (processedUsers > 0 && totalUsers && processedUsers < totalUsers) {
    const remainingUsers = totalUsers - processedUsers;
    const avgTimePerUser = 0.1 + 0.2; // 100ms rate limit + ~200ms API calls
    const remainingSeconds = remainingUsers * avgTimePerUser;
    const remainingHours = (remainingSeconds / 3600).toFixed(1);
    const remainingDays = (remainingSeconds / 86400).toFixed(1);

    console.log('Estimated Time to Completion:');
    console.log('═════════════════════════════════════════════════════');
    console.log(`Remaining Users:          ${remainingUsers.toLocaleString()}`);
    console.log(`Est. Hours Remaining:     ${remainingHours}h`);
    console.log(`Est. Days Remaining:      ${remainingDays} days\n`);
  } else if (processedUsers >= (totalUsers || 0)) {
    console.log('✓ Backfill complete!\n');
  }

  // Get recent activity
  const { data: recentPosts } = await supabase
    .from('bluesky_posts')
    .select('indexed_at')
    .order('indexed_at', { ascending: false })
    .limit(1);

  if (recentPosts && recentPosts.length > 0) {
    const lastActivity = new Date(recentPosts[0].indexed_at);
    const minutesAgo = Math.floor((Date.now() - lastActivity.getTime()) / 60000);
    
    console.log('Recent Activity:');
    console.log('═════════════════════════════════════════════════════');
    console.log(`Last Post Indexed:        ${minutesAgo} minutes ago`);
    
    if (minutesAgo > 10) {
      console.log('\n⚠️  Warning: No recent activity detected.');
      console.log('   The backfill process may not be running.\n');
    } else {
      console.log('✓ Backfill is actively running.\n');
    }
  }

  // Storage estimate
  const estimatedStorageGB = (
    (totalPosts || 0) * 0.5 +  // ~500 bytes per post
    (totalFollows || 0) * 0.1 + // ~100 bytes per follow
    (totalLikes || 0) * 0.1 +   // ~100 bytes per like
    (totalReposts || 0) * 0.1   // ~100 bytes per repost
  ) / 1024 / 1024 / 1024;

  console.log('Storage Estimate:');
  console.log('═════════════════════════════════════════════════════');
  console.log(`Current Usage:            ~${estimatedStorageGB.toFixed(2)} GB`);
  
  if (totalUsers && processedUsers < totalUsers) {
    const projectedGB = estimatedStorageGB * (totalUsers / processedUsers);
    console.log(`Projected Total:          ~${projectedGB.toFixed(2)} GB\n`);
  }

  // Top users by posts
  const { data: topPosters }: { data: any } = await supabase
    .from('bluesky_posts')
    .select('author_did, count(*)')
    .limit(5);

  if (topPosters && topPosters.length > 0) {
    console.log('Top Posters:');
    console.log('═════════════════════════════════════════════════════');
    
    for (const poster of topPosters.slice(0, 5)) {
      const { data: user } = await supabase
        .from('bluesky_users')
        .select('handle')
        .eq('did', poster.author_did)
        .single();
      
      if (user) {
        console.log(`  @${user.handle.padEnd(30)} ${poster.count} posts`);
      }
    }
    console.log();
  }
}

checkProgress().catch(console.error);
