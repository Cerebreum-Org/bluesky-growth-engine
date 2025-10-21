import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';


type Activity =
  | {
      id: string;
      type: 'user';
      timestamp: string;
      data: { handle: string; display_name: string | null; followers_count: number | null };
    }
  | {
      id: string;
      type: 'post';
      timestamp: string;
      data: { handle: string | null | undefined; display_name: string | null | undefined; text: string };
    }
  | {
      id: string;
      type: 'like' | 'repost';
      timestamp: string;
      data: { handle: string | null | undefined; display_name: string | null | undefined };
    };

export const revalidate = 1; // Cache for 1 second
export async function GET() {
  try {
    const now = new Date().toISOString();

    // Run count and activity queries concurrently so the endpoint stays snappy
    const [
      usersTotal,
      postsTotal,
      likesTotalRes,
      repostsTotal,
      usersRes,
      postsRes,
      likesRes,
      repostsRes,
    ] = await Promise.all([
      supabase.from('bluesky_users').select('*', { count: 'exact' }).limit(1),
      supabase.from('bluesky_posts').select('*', { count: 'exact' }).limit(1),
      supabase.from('bluesky_likes').select('*', { count: 'estimated' }).limit(1),
      supabase.from('bluesky_reposts').select('*', { count: 'exact' }).limit(1),
      supabase
        .from('bluesky_users')
        .select('did, handle, display_name, followers_count, updated_at')
        .lte('updated_at', now)
        .order('updated_at', { ascending: false })
        .limit(10),
      supabase
        .from('bluesky_posts')
        .select('uri, text, author_did, created_at')
        .lte('created_at', now)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('bluesky_likes')
        .select('uri, author_did, subject_uri, created_at')
        .lte('created_at', now)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('bluesky_reposts')
        .select('uri, author_did, subject_uri, created_at')
        .lte('created_at', now)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const totalUsers = usersTotal.count || 0;
    const totalPosts = postsTotal.count || 0;
    const totalLikes = likesTotalRes.count || 0;
    const totalReposts = repostsTotal.count || 0;

    // Get author handles
    const authorDids = new Set<string>();
    [postsRes.data, likesRes.data, repostsRes.data].forEach(items => {
      items?.forEach(item => authorDids.add(item.author_did));
    });

    const { data: authors } = await supabase
      .from('bluesky_users')
      .select('did, handle, display_name')
      .in('did', Array.from(authorDids));

    const authorMap = new Map(authors?.map(a => [a.did, a]) || []);

    // Build activities
    const activities: Activity[] = [];

    (usersRes.data || []).forEach(user => {
      activities.push({
        id: `${user.did}-${user.updated_at ?? now}`,
        type: 'user',
        timestamp: user.updated_at ?? now,
        data: {
          handle: user.handle,
          display_name: user.display_name,
          followers_count: user.followers_count,
        }
      });
    });

    (postsRes.data || []).forEach(post => {
      const author = authorMap.get(post.author_did);
      activities.push({
        id: post.uri,
        type: 'post',
        timestamp: post.created_at,
        data: {
          handle: author?.handle,
          display_name: author?.display_name,
          text: post.text?.substring(0, 100) || '',
        }
      });
    });

    (likesRes.data || []).forEach(like => {
      const author = authorMap.get(like.author_did);
      activities.push({
        id: like.uri,
        type: 'like',
        timestamp: like.created_at,
        data: {
          handle: author?.handle,
          display_name: author?.display_name,
        }
      });
    });

    (repostsRes.data || []).forEach(repost => {
      const author = authorMap.get(repost.author_did);
      activities.push({
        id: repost.uri,
        type: 'repost',
        timestamp: repost.created_at,
        data: {
          handle: author?.handle,
          display_name: author?.display_name,
        }
      });
    });

    activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      counts: {
        users: totalUsers,
        posts: totalPosts,
        likes: totalLikes,
        reposts: totalReposts,
      },
      activities: activities.slice(0, 15),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching live activity:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
