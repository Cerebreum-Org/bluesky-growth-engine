import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 2,
});

export async function GET() {
  let client;
  try {
    client = await pool.connect();

    // Get total count and recent users
    const [totalResult, recentUsers] = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM bluesky_users'),
      client.query(`
        SELECT did, handle, display_name, followers_count, updated_at
        FROM bluesky_users
        WHERE updated_at IS NOT NULL
        ORDER BY updated_at DESC
        LIMIT 10
      `)
    ]);

    return NextResponse.json({
      totalUsers: parseInt(totalResult.rows[0]?.count || '0'),
      recentUsers: recentUsers.rows || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching live stats:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch stats' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
