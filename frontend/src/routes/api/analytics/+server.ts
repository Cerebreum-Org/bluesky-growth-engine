import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { blueskyUsers, blueskyPosts } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Viral posts (high engagement)
    const viralPosts = await db.execute(sql`
      SELECT 
        p.uri,
        p.text,
        p.author_did,
        u.handle,
        u.display_name,
        p.like_count,
        p.repost_count,
        p.reply_count,
        p.quote_count,
        p.created_at,
        (p.like_count + p.repost_count * 2 + p.reply_count + p.quote_count) as engagement_score,
        CASE 
          WHEN u.followers_count > 0 THEN 
            ((p.like_count + p.repost_count * 2 + p.reply_count + p.quote_count)::float / u.followers_count) * 100
          ELSE 0
        END as engagement_rate
      FROM bluesky_posts p
      JOIN bluesky_users u ON p.author_did = u.did
      WHERE p.created_at >= NOW() - INTERVAL '7 days'
        AND (p.like_count + p.repost_count + p.reply_count + p.quote_count) > 10
      ORDER BY engagement_score DESC
      LIMIT 20
    `);

    // Top posts by time of day
    const postsByHour = await db.execute(sql`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as post_count,
        AVG(like_count + repost_count + reply_count) as avg_engagement
      FROM bluesky_posts
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `);

    // Engagement rate by follower count tier - Fixed query
    const engagementByTier = await db.execute(sql`
      WITH user_tiers AS (
        SELECT 
          u.did,
          u.followers_count,
          CASE
            WHEN u.followers_count < 100 THEN '0-100'
            WHEN u.followers_count < 1000 THEN '100-1K'
            WHEN u.followers_count < 10000 THEN '1K-10K'
            WHEN u.followers_count < 100000 THEN '10K-100K'
            ELSE '100K+'
          END as follower_tier
        FROM bluesky_users u
      )
      SELECT 
        ut.follower_tier,
        COUNT(DISTINCT ut.did) as user_count,
        COALESCE(AVG(p.like_count + p.repost_count + p.reply_count), 0) as avg_engagement,
        COALESCE(SUM(p.like_count + p.repost_count + p.reply_count), 0) as total_engagement
      FROM user_tiers ut
      LEFT JOIN bluesky_posts p ON ut.did = p.author_did
        AND p.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY ut.follower_tier
      ORDER BY 
        CASE ut.follower_tier
          WHEN '0-100' THEN 1
          WHEN '100-1K' THEN 2
          WHEN '1K-10K' THEN 3
          WHEN '10K-100K' THEN 4
          ELSE 5
        END
    `);

    // Most active users by posts
    const mostActiveUsers = await db.execute(sql`
      SELECT 
        u.did,
        u.handle,
        u.display_name,
        u.followers_count,
        COUNT(p.uri) as posts_last_7_days,
        AVG(p.like_count + p.repost_count + p.reply_count) as avg_engagement
      FROM bluesky_users u
      JOIN bluesky_posts p ON u.did = p.author_did
      WHERE p.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY u.did, u.handle, u.display_name, u.followers_count
      HAVING COUNT(p.uri) > 5
      ORDER BY posts_last_7_days DESC
      LIMIT 20
    `);

    return json({
      viralPosts: viralPosts.rows,
      postsByHour: postsByHour.rows,
      engagementByTier: engagementByTier.rows,
      mostActiveUsers: mostActiveUsers.rows
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
