import 'dotenv/config';
import { supabase } from './supabase.js';

/**
 * Network Analytics Queries
 * 
 * Run various analytical queries on the social graph data
 */

async function runAnalytics() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║              SOCIAL GRAPH ANALYTICS                    ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // 1. Top influencers by combined metrics
  console.log('═══ TOP 25 INFLUENCERS ═══\n');
  const { data: influencers } = await supabase
    .from('user_engagement_stats')
    .select(`
      did,
      handle,
      post_count,
      total_likes_received,
      total_reposts_received,
      total_replies_received
    `)
    .order('total_likes_received', { ascending: false })
    .limit(25);

  if (influencers) {
    console.log('Rank | Handle                    | Posts | Likes | Reposts | Replies | Score');
    console.log('─────┼───────────────────────────┼───────┼───────┼─────────┼─────────┼────────');
    
    influencers.forEach((user, i) => {
      const score = 
        (user.post_count || 0) +
        (user.total_likes_received || 0) +
        (user.total_reposts_received || 0) * 2 +
        (user.total_replies_received || 0) * 1.5;
      
      console.log(
        `${String(i + 1).padStart(4)} | ` +
        `${user.handle.slice(0, 25).padEnd(25)} | ` +
        `${String(user.post_count || 0).padStart(5)} | ` +
        `${String(user.total_likes_received || 0).padStart(5)} | ` +
        `${String(user.total_reposts_received || 0).padStart(7)} | ` +
        `${String(user.total_replies_received || 0).padStart(7)} | ` +
        `${score.toFixed(0)}`
      );
    });
  }
  console.log('\n');

  // 2. Most active posters
  console.log('═══ TOP 20 MOST ACTIVE POSTERS ═══\n');
  const { data: activePosters } = await supabase
    .from('user_engagement_stats')
    .select('did, handle, post_count')
    .order('post_count', { ascending: false })
    .limit(20);

  if (activePosters) {
    activePosters.forEach((user, i) => {
      console.log(`${String(i + 1).padStart(2)}. @${user.handle.padEnd(30)} ${user.post_count || 0} posts`);
    });
  }
  console.log('\n');

  // 3. Engagement ratio (likes per post)
  console.log('═══ BEST ENGAGEMENT RATIO (Likes per Post) ═══\n');
  const { data: engagementRatio } = await supabase
    .from('user_engagement_stats')
    .select('did, handle, post_count, total_likes_received')
    .gt('post_count', 10) // At least 10 posts
    .order('total_likes_received', { ascending: false })
    .limit(20);

  if (engagementRatio) {
    const withRatio = engagementRatio
      .map(u => ({
        ...u,
        ratio: (u.total_likes_received || 0) / (u.post_count || 1)
      }))
      .sort((a, b) => b.ratio - a.ratio);

    withRatio.forEach((user, i) => {
      console.log(
        `${String(i + 1).padStart(2)}. @${user.handle.padEnd(30)} ` +
        `${user.ratio.toFixed(1)} likes/post (${user.total_likes_received || 0} total)`
      );
    });
  }
  console.log('\n');

  // 4. Mutual follows analysis
  console.log('═══ MUTUAL FOLLOWS ANALYSIS ═══\n');
  
  // This would be expensive, so we'll use a SQL query
  const { data: mutualStats } = await supabase.rpc('get_mutual_follow_stats');
  
  if (mutualStats) {
    console.log(mutualStats);
  } else {
    console.log('(Run this manually in Supabase SQL editor:)');
    console.log(`
SELECT 
  COUNT(DISTINCT f1.follower_did) as users_with_mutuals,
  COUNT(*) as total_mutual_pairs
FROM bluesky_follows f1
JOIN bluesky_follows f2 
  ON f1.follower_did = f2.following_did 
  AND f1.following_did = f2.follower_did
WHERE f1.follower_did < f1.following_did;
    `);
  }
  console.log('\n');

  // 5. Follower distribution
  console.log('═══ FOLLOWER DISTRIBUTION ═══\n');
  const { data: followerDist } = await supabase
    .from('bluesky_users')
    .select('followers_count');

  if (followerDist) {
    const counts = followerDist.map(u => u.followers_count || 0).sort((a, b) => a - b);
    const percentiles = [10, 25, 50, 75, 90, 95, 99];
    
    console.log('Percentile | Followers');
    console.log('───────────┼──────────');
    
    percentiles.forEach(p => {
      const index = Math.floor(counts.length * p / 100);
      console.log(`${String(p).padStart(9)}% | ${counts[index]?.toLocaleString() || 0}`);
    });

    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const max = counts[counts.length - 1];
    console.log(`   Average | ${avg.toFixed(0)}`);
    console.log(`   Maximum | ${max?.toLocaleString() || 0}`);
  }
  console.log('\n');

  // 6. Content type analysis
  console.log('═══ CONTENT TYPE ANALYSIS ═══\n');
  const { data: embedTypes } = await supabase
    .from('bluesky_posts')
    .select('embed_type');

  if (embedTypes) {
    const typeCounts = embedTypes.reduce((acc, post) => {
      const type = post.embed_type || 'text_only';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    
    sorted.forEach(([type, count]) => {
      const pct = (count / embedTypes.length * 100).toFixed(1);
      console.log(`${type.padEnd(40)} ${count.toLocaleString().padStart(10)} (${pct}%)`);
    });
  }
  console.log('\n');

  // 7. Reply threads analysis
  console.log('═══ MOST REPLIED-TO POSTS ═══\n');
  const { data: mostReplied } = await supabase
    .from('bluesky_posts')
    .select('uri, text, author_did, reply_count, like_count, repost_count')
    .order('reply_count', { ascending: false })
    .limit(10);

  if (mostReplied) {
    for (const post of mostReplied) {
      const { data: author } = await supabase
        .from('bluesky_users')
        .select('handle')
        .eq('did', post.author_did)
        .single();

      const textPreview = (post.text || '').slice(0, 60).replace(/\n/g, ' ');
      console.log(`@${author?.handle || 'unknown'}`);
      console.log(`  "${textPreview}..."`);
      console.log(`  ${post.reply_count} replies | ${post.like_count} likes | ${post.repost_count} reposts\n`);
    }
  }

  // 8. Power users (heavy engagers)
  console.log('═══ POWER USERS (Most Engagement Given) ═══\n');
  const { data: powerUsers } = await supabase
    .from('user_engagement_stats')
    .select('handle, post_count, like_count, repost_count')
    .order('like_count', { ascending: false })
    .limit(15);

  if (powerUsers) {
    powerUsers.forEach((user, i) => {
      const totalEngagement = (user.post_count || 0) + (user.like_count || 0) + (user.repost_count || 0);
      console.log(
        `${String(i + 1).padStart(2)}. @${user.handle.padEnd(30)} ` +
        `Posts: ${(user.post_count || 0).toString().padStart(5)} | ` +
        `Likes: ${(user.like_count || 0).toString().padStart(6)} | ` +
        `Reposts: ${(user.repost_count || 0).toString().padStart(5)}`
      );
    });
  }
  console.log('\n');

  // 9. Community overlap (users who follow each other)
  console.log('═══ NETWORK DENSITY ═══\n');
  const { count: totalUsers } = await supabase
    .from('bluesky_users')
    .select('*', { count: 'exact', head: true });

  const { count: totalFollows } = await supabase
    .from('bluesky_follows')
    .select('*', { count: 'exact', head: true });

  if (totalUsers && totalFollows) {
    const maxPossibleEdges = totalUsers * (totalUsers - 1);
    const density = (totalFollows / maxPossibleEdges * 100).toFixed(4);
    const avgDegree = (totalFollows / totalUsers).toFixed(2);

    console.log(`Total Users:              ${totalUsers.toLocaleString()}`);
    console.log(`Total Follows:            ${totalFollows.toLocaleString()}`);
    console.log(`Network Density:          ${density}%`);
    console.log(`Avg Connections/User:     ${avgDegree}`);
  }
  console.log('\n');

  // 10. Growth potential (users with high follower/following ratio)
  console.log('═══ HIGH-VALUE TARGETS (High Follower/Following Ratio) ═══\n');
  const { data: highValue } = await supabase
    .from('bluesky_users')
    .select('handle, followers_count, following_count')
    .gt('followers_count', 1000)
    .gt('following_count', 10)
    .order('followers_count', { ascending: false })
    .limit(20);

  if (highValue) {
    const withRatio = highValue
      .map(u => ({
        ...u,
        ratio: (u.followers_count || 0) / (u.following_count || 1)
      }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 15);

    withRatio.forEach((user, i) => {
      console.log(
        `${String(i + 1).padStart(2)}. @${user.handle.padEnd(30)} ` +
        `${(user.followers_count || 0).toLocaleString().padStart(6)} followers | ` +
        `${user.ratio.toFixed(1)}x ratio`
      );
    });
  }
  console.log('\n');

  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║              ANALYTICS COMPLETE                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
}

runAnalytics().catch(console.error);
