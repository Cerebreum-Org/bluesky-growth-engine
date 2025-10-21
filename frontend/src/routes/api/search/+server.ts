import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { blueskyUsers } from '$lib/server/db/schema';
import { sql, or, ilike, gte, lte, and } from 'drizzle-orm';

export async function GET({ url }) {
  try {
    const query = url.searchParams.get('q') || '';
    const minFollowers = parseInt(url.searchParams.get('minFollowers') || '0');
    const maxFollowers = parseInt(url.searchParams.get('maxFollowers') || '999999999');
    const generation = url.searchParams.get('generation');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    if (!query && !generation && minFollowers === 0 && maxFollowers === 999999999) {
      return json({ users: [] });
    }

    let conditions: any[] = [];

    if (query) {
      conditions.push(
        or(
          ilike(blueskyUsers.handle, `%${query}%`),
          ilike(blueskyUsers.displayName, `%${query}%`)
        )
      );
    }

    if (minFollowers > 0) {
      conditions.push(gte(blueskyUsers.followersCount, minFollowers));
    }

    if (maxFollowers < 999999999) {
      conditions.push(lte(blueskyUsers.followersCount, maxFollowers));
    }

    if (generation) {
      conditions.push(sql`${blueskyUsers.generation} = ${parseInt(generation)}`);
    }

    const users = await db
      .select({
        did: blueskyUsers.did,
        handle: blueskyUsers.handle,
        displayName: blueskyUsers.displayName,
        description: blueskyUsers.description,
        avatar: blueskyUsers.avatar,
        followersCount: blueskyUsers.followersCount,
        followingCount: blueskyUsers.followingCount,
        postsCount: blueskyUsers.postsCount,
        generation: blueskyUsers.generation,
        createdAt: blueskyUsers.createdAt
      })
      .from(blueskyUsers)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${blueskyUsers.followersCount} DESC NULLS LAST`)
      .limit(limit);

    return json({ users, count: users.length });
  } catch (error) {
    console.error('Error searching users:', error);
    return json({ error: 'Failed to search users' }, { status: 500 });
  }
}
