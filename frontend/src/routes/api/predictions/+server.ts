import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { blueskyUsers, blueskyPosts } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Predict likely viral users based on engagement velocity
    const risingStars = await db.execute(sql`
      WITH recent_performance AS (
        SELECT 
          u.did,
          u.handle,
          u.display_name,
          u.followers_count,
          COUNT(p.uri) as posts_last_7_days,
          AVG(p.like_count + p.repost_count * 2 + p.reply_count) as avg_engagement,
          MAX(p.like_count + p.repost_count + p.reply_count) as max_engagement,
          CASE 
            WHEN u.followers_count > 0 THEN 
              (AVG(p.like_count + p.repost_count + p.reply_count)::float / u.followers_count) * 100
            ELSE 0
          END as engagement_rate
        FROM bluesky_users u
        JOIN bluesky_posts p ON u.did = p.author_did
        WHERE p.created_at >= NOW() - INTERVAL '7 days'
          AND u.followers_count BETWEEN 500 AND 50000
        GROUP BY u.did, u.handle, u.display_name, u.followers_count
        HAVING COUNT(p.uri) >= 3
      )
      SELECT 
        did,
        handle,
        display_name,
        followers_count,
        posts_last_7_days,
        ROUND(avg_engagement::numeric, 2) as avg_engagement,
        max_engagement,
        ROUND(engagement_rate::numeric, 2) as engagement_rate,
        -- Viral potential score
        ROUND((
          (engagement_rate * 0.4) + 
          (LEAST(posts_last_7_days / 10.0, 1) * 30) +
          (LEAST(max_engagement / 1000.0, 1) * 30)
        )::numeric, 2) as viral_potential_score
      FROM recent_performance
      WHERE engagement_rate > 5
      ORDER BY viral_potential_score DESC
      LIMIT 30
    `);

    // Trending topics/patterns
    const trendingPatterns = await db.execute(sql`
      WITH hourly_activity AS (
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          COUNT(*) as post_count,
          SUM(like_count + repost_count) as total_engagement
        FROM bluesky_posts
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', created_at)
      )
      SELECT 
        hour,
        post_count,
        total_engagement,
        ROUND((total_engagement::float / NULLIF(post_count, 0))::numeric, 2) as engagement_per_post
      FROM hourly_activity
      ORDER BY hour DESC
    `);

    // Growth momentum - users with accelerating follower growth
    const growthMomentum = await db.execute(sql`
      SELECT 
        u.did,
        u.handle,
        u.display_name,
        u.followers_count,
        u.posts_count,
        COUNT(DISTINCT p.uri) FILTER (WHERE p.created_at >= NOW() - INTERVAL '7 days') as recent_posts,
        AVG(p.like_count + p.repost_count) FILTER (WHERE p.created_at >= NOW() - INTERVAL '7 days') as recent_avg_engagement,
        AVG(p.like_count + p.repost_count) FILTER (WHERE p.created_at >= NOW() - INTERVAL '30 days' AND p.created_at < NOW() - INTERVAL '7 days') as older_avg_engagement
      FROM bluesky_users u
      LEFT JOIN bluesky_posts p ON u.did = p.author_did
      WHERE u.indexed_at >= NOW() - INTERVAL '60 days'
        AND u.followers_count > 100
      GROUP BY u.did, u.handle, u.display_name, u.followers_count, u.posts_count
      HAVING 
        COUNT(DISTINCT p.uri) FILTER (WHERE p.created_at >= NOW() - INTERVAL '7 days') >= 2
        AND AVG(p.like_count + p.repost_count) FILTER (WHERE p.created_at >= NOW() - INTERVAL '7 days') > 
            COALESCE(AVG(p.like_count + p.repost_count) FILTER (WHERE p.created_at >= NOW() - INTERVAL '30 days' AND p.created_at < NOW() - INTERVAL '7 days'), 0) * 1.5
      ORDER BY recent_avg_engagement DESC
      LIMIT 20
    `);

    return json({
      risingStars: risingStars.rows,
      trendingPatterns: trendingPatterns.rows,
      growthMomentum: growthMomentum.rows
    });
  } catch (error) {
    console.error('Error fetching predictions:', error);
    return json({ error: 'Failed to fetch predictions' }, { status: 500 });
  }
}
