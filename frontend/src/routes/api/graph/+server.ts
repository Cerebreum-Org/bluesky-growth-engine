import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { blueskyUsers, blueskyFollows } from '$lib/server/db/schema';
import { sql, and, gte, inArray } from 'drizzle-orm';

export async function GET({ url }) {
  try {
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const minFollowers = parseInt(url.searchParams.get('minFollowers') || '1000');
    
    // Get top users with minimum followers
    const topUsers = await db
      .select({
        did: blueskyUsers.did,
        handle: blueskyUsers.handle,
        displayName: blueskyUsers.displayName,
        followersCount: blueskyUsers.followersCount,
        generation: blueskyUsers.generation
      })
      .from(blueskyUsers)
      .where(gte(blueskyUsers.followersCount, minFollowers))
      .orderBy(sql`${blueskyUsers.followersCount} DESC NULLS LAST`)
      .limit(limit);
    
    if (topUsers.length === 0) {
      return json({ nodes: [], links: [] });
    }
    
    const userDids = topUsers.map(u => u.did);
    
    // Get follow relationships between these users
    const follows = await db
      .select({
        follower: blueskyFollows.followerDid,
        following: blueskyFollows.followingDid
      })
      .from(blueskyFollows)
      .where(
        and(
          inArray(blueskyFollows.followerDid, userDids),
          inArray(blueskyFollows.followingDid, userDids)
        )
      );
    
    // Format data for D3
    const nodes = topUsers.map(user => ({
      id: user.did,
      name: user.displayName || user.handle,
      handle: user.handle,
      followers: user.followersCount || 0,
      generation: user.generation || 0
    }));
    
    const links = follows.map(follow => ({
      source: follow.follower,
      target: follow.following
    }));
    
    return json({ nodes, links });
  } catch (error) {
    console.error('Error fetching graph data:', error);
    return json({ error: 'Failed to fetch graph data' }, { status: 500 });
  }
}
