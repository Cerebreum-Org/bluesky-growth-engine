import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Get total count
    const { count: totalUsers } = await supabase
      .from('bluesky_users')
      .select('*', { count: 'exact', head: true });

    // Get 10 most recently updated users
    const { data: recentUsers } = await supabase
      .from('bluesky_users')
      .select('did, handle, display_name, followers_count, updated_at')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(10);

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      recentUsers: recentUsers || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching live stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
