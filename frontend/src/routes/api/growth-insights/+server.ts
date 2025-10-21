import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { blueskyUsers, blueskyPosts } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Cohort analysis - users indexed by week
    const cohortAnalysis = await db.execute(sql`
      WITH weekly_cohorts AS (
        SELECT 
          DATE_TRUNC('week', indexed_at) as cohort_week,
          did,
          indexed_at
        FROM bluesky_users
        WHERE indexed_at >= NOW() - INTERVAL '12 weeks'
      ),
      cohort_activity AS (
        SELECT 
          wc.cohort_week,
          COUNT(DISTINCT wc.did) as cohort_size,
          COUNT(DISTINCT CASE WHEN p.created_at >= NOW() - INTERVAL '7 days' THEN wc.did END) as active_users
        FROM weekly_cohorts wc
        LEFT JOIN bluesky_posts p ON wc.did = p.author_did
        GROUP BY wc.cohort_week
      )
      SELECT 
        cohort_week,
        cohort_size,
        active_users,
        CASE WHEN cohort_size > 0 THEN (active_users::float / cohort_size * 100) ELSE 0 END as retention_rate
      FROM cohort_activity
      ORDER BY cohort_week DESC
    `);

    // Growth correlations
    const growthCorrelations = await db.execute(sql`
      WITH post_tiers AS (
        SELECT 
          CASE
            WHEN posts_count = 0 THEN '0 posts'
            WHEN posts_count < 10 THEN '1-10 posts'
            WHEN posts_count < 50 THEN '10-50 posts'
            WHEN posts_count < 100 THEN '50-100 posts'
            ELSE '100+ posts'
          END as post_tier,
          followers_count
        FROM bluesky_users
        WHERE indexed_at >= NOW() - INTERVAL '30 days'
      )
      SELECT 
        post_tier,
        COUNT(*) as user_count,
        AVG(followers_count) as avg_followers,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY followers_count) as median_followers
      FROM post_tiers
      GROUP BY post_tier
    `);

    // Growth velocity
    const growthVelocity = await db.execute(sql`
      SELECT 
        DATE(indexed_at) as date,
        COUNT(*) as new_users,
        AVG(followers_count) as avg_initial_followers,
        COUNT(CASE WHEN posts_count > 0 THEN 1 END) as users_with_posts
      FROM bluesky_users
      WHERE indexed_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(indexed_at)
      ORDER BY date DESC
    `);

    return json({
      cohortAnalysis: cohortAnalysis.rows,
      growthCorrelations: growthCorrelations.rows,
      growthVelocity: growthVelocity.rows
    });
  } catch (error) {
    console.error('Error fetching growth insights:', error);
    return json({ error: 'Failed to fetch growth insights' }, { status: 500 });
  }
}
