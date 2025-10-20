import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET() {
  try {
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // last 5 minutes

    const [usersTotal, usersWithPosts, postsTotal, followsTotal, likesTotal, repostsTotal, postsRecent, followsRecent, likesRecent, repostsRecent, lastPost, lastFollow, lastLike, lastRepost] = await Promise.all([
      supabase.from('bluesky_users').select('*', { count: 'exact' }).limit(1),
      supabase.from('bluesky_users').select('*', { count: 'exact' }).gt('posts_count', 0).limit(1),
      supabase.from('bluesky_posts').select('*', { count: 'exact' }).limit(1),
      supabase.from('bluesky_follows').select('*', { count: 'exact' }).limit(1),
      supabase.from('bluesky_likes').select('*', { count: 'exact' }).limit(1),
      supabase.from('bluesky_reposts').select('*', { count: 'exact' }).limit(1),
      supabase.from('bluesky_posts').select('*', { count: 'exact' }).gte('indexed_at', since).limit(1),
      supabase.from('bluesky_follows').select('*', { count: 'exact' }).gte('indexed_at', since).limit(1),
      supabase.from('bluesky_likes').select('*', { count: 'exact' }).gte('indexed_at', since).limit(1),
      supabase.from('bluesky_reposts').select('*', { count: 'exact' }).gte('indexed_at', since).limit(1),
      supabase.from('bluesky_posts').select('indexed_at').order('indexed_at', { ascending: false }).limit(1),
      supabase.from('bluesky_follows').select('indexed_at').order('indexed_at', { ascending: false }).limit(1),
      supabase.from('bluesky_likes').select('indexed_at').order('indexed_at', { ascending: false }).limit(1),
      supabase.from('bluesky_reposts').select('indexed_at').order('indexed_at', { ascending: false }).limit(1),
    ]);

    const minutes = 5;
    const rate = {
      postsPerMin: (postsRecent.count || 0) / minutes,
      followsPerMin: (followsRecent.count || 0) / minutes,
      likesPerMin: (likesRecent.count || 0) / minutes,
      repostsPerMin: (repostsRecent.count || 0) / minutes,
    };

    const coverage = {
      totalUsers: usersTotal.count || 0,
      usersWithPosts: usersWithPosts.count || 0,
      percent: usersTotal.count ? ((usersWithPosts.count || 0) / usersTotal.count) * 100 : 0,
    };

    const latest = {
      post: lastPost.data?.[0]?.indexed_at || null,
      follow: lastFollow.data?.[0]?.indexed_at || null,
      like: lastLike.data?.[0]?.indexed_at || null,
      repost: lastRepost.data?.[0]?.indexed_at || null,
    };

    const totals = {
      posts: postsTotal.count || 0,
      follows: followsTotal.count || 0,
      likes: likesTotal.count || 0,
      reposts: repostsTotal.count || 0,
    };

    return NextResponse.json({ coverage, rate, totals, latest }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'metrics_error' }, { status: 500 });
  }
}
