import { NextResponse } from 'next/server';
import { Pool } from 'pg';

// Direct PostgreSQL connection (more reliable than PostgREST for internal APIs)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 2, // Limit connections from frontend
});

export async function GET() {
  let client;
  try {
    client = await pool.connect();
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // last 5 minutes

    // Run queries in parallel
    const [usersTotal, usersWithPosts, postsTotal, followsTotal, likesTotal, repostsTotal,
           postsRecent, followsRecent, likesRecent, repostsRecent,
           lastPost, lastFollow, lastLike, lastRepost] = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM bluesky_users'),
      client.query('SELECT COUNT(*) as count FROM bluesky_users WHERE posts_count > 0'),
      client.query('SELECT COUNT(*) as count FROM bluesky_posts'),
      client.query('SELECT COUNT(*) as count FROM bluesky_follows'),
      client.query('SELECT COUNT(*) as count FROM bluesky_likes'),
      client.query('SELECT COUNT(*) as count FROM bluesky_reposts'),
      client.query('SELECT COUNT(*) as count FROM bluesky_posts WHERE indexed_at >= $1', [since]),
      client.query('SELECT COUNT(*) as count FROM bluesky_follows WHERE created_at >= $1', [since]),
      client.query('SELECT COUNT(*) as count FROM bluesky_likes WHERE indexed_at >= $1', [since]),
      client.query('SELECT COUNT(*) as count FROM bluesky_reposts WHERE indexed_at >= $1', [since]),
      client.query('SELECT indexed_at FROM bluesky_posts ORDER BY indexed_at DESC LIMIT 1'),
      client.query('SELECT created_at as indexed_at FROM bluesky_follows ORDER BY created_at DESC LIMIT 1'),
      client.query('SELECT indexed_at FROM bluesky_likes ORDER BY indexed_at DESC LIMIT 1'),
      client.query('SELECT indexed_at FROM bluesky_reposts ORDER BY indexed_at DESC LIMIT 1'),
    ]);

    const minutes = 5;
    const rate = {
      postsPerMin: parseInt(postsRecent.rows[0]?.count || '0') / minutes,
      followsPerMin: parseInt(followsRecent.rows[0]?.count || '0') / minutes,
      likesPerMin: parseInt(likesRecent.rows[0]?.count || '0') / minutes,
      repostsPerMin: parseInt(repostsRecent.rows[0]?.count || '0') / minutes,
    };

    const totalUsers = parseInt(usersTotal.rows[0]?.count || '0');
    const withPosts = parseInt(usersWithPosts.rows[0]?.count || '0');
    
    const coverage = {
      totalUsers,
      usersWithPosts: withPosts,
      percent: totalUsers ? (withPosts / totalUsers) * 100 : 0,
    };

    const latest = {
      post: lastPost.rows[0]?.indexed_at || null,
      follow: lastFollow.rows[0]?.indexed_at || null,
      like: lastLike.rows[0]?.indexed_at || null,
      repost: lastRepost.rows[0]?.indexed_at || null,
    };

    const totals = {
      posts: parseInt(postsTotal.rows[0]?.count || '0'),
      follows: parseInt(followsTotal.rows[0]?.count || '0'),
      likes: parseInt(likesTotal.rows[0]?.count || '0'),
      reposts: parseInt(repostsTotal.rows[0]?.count || '0'),
    };

    return NextResponse.json({ coverage, rate, totals, latest }, { status: 200 });
  } catch (e: any) {
    console.error('Metrics error:', e);
    return NextResponse.json({ error: e?.message || 'metrics_error' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
