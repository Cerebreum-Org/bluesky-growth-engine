import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { blueskyUsers, blueskyFollows, blueskyPosts } from '$lib/server/db/schema';
import { sql, count } from 'drizzle-orm';

export async function GET() {
  try {
    const [totalUsers] = await db.select({ count: count() }).from(blueskyUsers);
    const [totalFollows] = await db.select({ count: count() }).from(blueskyFollows);
    const [totalPosts] = await db.select({ count: count() }).from(blueskyPosts);
    
    const usersByGeneration = await db
      .select({
        generation: blueskyUsers.generation,
        count: count()
      })
      .from(blueskyUsers)
      .groupBy(blueskyUsers.generation)
      .orderBy(blueskyUsers.generation);
    
    const topUsers = await db
      .select({
        did: blueskyUsers.did,
        handle: blueskyUsers.handle,
        displayName: blueskyUsers.displayName,
        followersCount: blueskyUsers.followersCount,
        postsCount: blueskyUsers.postsCount
      })
      .from(blueskyUsers)
      .orderBy(sql`${blueskyUsers.followersCount} DESC NULLS LAST`)
      .limit(10);
    
    const growthData = await db.execute(sql`
      SELECT 
        DATE(indexed_at) as date,
        COUNT(*) as new_users
      FROM bluesky_users
      WHERE indexed_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(indexed_at)
      ORDER BY date DESC
    `);

    return json({
      totalUsers: totalUsers.count,
      totalFollows: totalFollows.count,
      totalPosts: totalPosts.count,
      usersByGeneration,
      topUsers,
      growthData: growthData.rows
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
