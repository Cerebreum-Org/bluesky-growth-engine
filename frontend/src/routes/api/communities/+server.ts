import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { blueskyUsers, blueskyFollows } from '$lib/server/db/schema';
import { sql, desc, inArray } from 'drizzle-orm';

export async function GET() {
  try {
    // Find bridge users (users who connect different communities)
    // These are users who follow AND are followed by highly connected users
    const bridgeUsers = await db.execute(sql`
      WITH user_connections AS (
        SELECT 
          follower_did as did,
          COUNT(DISTINCT following_did) as outgoing,
          (SELECT COUNT(*) FROM bluesky_follows WHERE following_did = follower_did) as incoming
        FROM bluesky_follows
        GROUP BY follower_did
        HAVING COUNT(DISTINCT following_did) > 10
      )
      SELECT 
        u.did,
        u.handle,
        u.display_name,
        u.followers_count,
        uc.outgoing,
        uc.incoming,
        (uc.outgoing + uc.incoming) as total_connections
      FROM user_connections uc
      JOIN bluesky_users u ON uc.did = u.did
      WHERE uc.incoming > 50 AND uc.outgoing > 50
      ORDER BY total_connections DESC
      LIMIT 20
    `);

    // Find mutual follow clusters (tight-knit communities)
    const mutualClusters = await db.execute(sql`
      WITH mutual_follows AS (
        SELECT 
          f1.follower_did as user1,
          f1.following_did as user2
        FROM bluesky_follows f1
        JOIN bluesky_follows f2 
          ON f1.follower_did = f2.following_did 
          AND f1.following_did = f2.follower_did
      ),
      cluster_members AS (
        SELECT 
          user1 as did,
          COUNT(*) as mutual_count
        FROM mutual_follows
        GROUP BY user1
        HAVING COUNT(*) > 5
      )
      SELECT 
        u.did,
        u.handle,
        u.display_name,
        u.followers_count,
        cm.mutual_count
      FROM cluster_members cm
      JOIN bluesky_users u ON cm.did = u.did
      ORDER BY cm.mutual_count DESC
      LIMIT 20
    `);

    // Find emerging influencers (high engagement, growing followers)
    const emergingInfluencers = await db.execute(sql`
      SELECT 
        u.did,
        u.handle,
        u.display_name,
        u.followers_count,
        u.posts_count,
        COUNT(DISTINCT p.uri) as recent_posts,
        AVG(p.like_count + p.repost_count * 2 + p.reply_count) as avg_engagement,
        CASE 
          WHEN u.followers_count > 0 THEN 
            (AVG(p.like_count + p.repost_count + p.reply_count)::float / u.followers_count) * 100
          ELSE 0
        END as engagement_rate
      FROM bluesky_users u
      JOIN bluesky_posts p ON u.did = p.author_did
      WHERE p.created_at >= NOW() - INTERVAL '7 days'
        AND u.followers_count BETWEEN 1000 AND 50000
      GROUP BY u.did, u.handle, u.display_name, u.followers_count, u.posts_count
      HAVING COUNT(DISTINCT p.uri) >= 5
      ORDER BY engagement_rate DESC
      LIMIT 20
    `);

    // Find content hubs (users with high repost/quote counts)
    const contentHubs = await db.execute(sql`
      SELECT 
        u.did,
        u.handle,
        u.display_name,
        u.followers_count,
        SUM(p.repost_count + p.quote_count) as total_shares,
        AVG(p.repost_count + p.quote_count) as avg_shares_per_post,
        COUNT(p.uri) as post_count
      FROM bluesky_users u
      JOIN bluesky_posts p ON u.did = p.author_did
      WHERE p.created_at >= NOW() - INTERVAL '7 days'
        AND (p.repost_count + p.quote_count) > 0
      GROUP BY u.did, u.handle, u.display_name, u.followers_count
      HAVING COUNT(p.uri) >= 3
      ORDER BY total_shares DESC
      LIMIT 20
    `);

    return json({
      bridgeUsers: bridgeUsers.rows,
      mutualClusters: mutualClusters.rows,
      emergingInfluencers: emergingInfluencers.rows,
      contentHubs: contentHubs.rows
    });
  } catch (error) {
    console.error('Error fetching communities:', error);
    return json({ error: 'Failed to fetch communities' }, { status: 500 });
  }
}
