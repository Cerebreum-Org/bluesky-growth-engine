import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const revalidate = 1;

export async function GET() {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // Get recent blocks
    const { data: recentBlocks, error: blocksError } = await supabase
      .from('bluesky_blocks')
      .select('author_did, subject_did, created_at')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get recent lists
    const { data: recentLists, error: listsError } = await supabase
      .from('bluesky_lists')
      .select('uri, author_did, name, purpose, description, created_at')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get recent list memberships
    const { data: recentListItems, error: listItemsError } = await supabase
      .from('bluesky_list_items')
      .select('uri, author_did, subject_did, list_uri, created_at')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get counts
    const [blocksCount, listsCount, listItemsCount] = await Promise.all([
      supabase.from('bluesky_blocks').select('*', { count: 'exact' }).limit(1),
      supabase.from('bluesky_lists').select('*', { count: 'exact' }).limit(1),
      supabase.from('bluesky_list_items').select('*', { count: 'exact' }).limit(1),
    ]);

    return NextResponse.json({
      counts: {
        blocks: blocksCount.count || 0,
        lists: listsCount.count || 0,
        listItems: listItemsCount.count || 0,
      },
      recent: {
        blocks: recentBlocks || [],
        lists: recentLists || [],
        listItems: recentListItems || [],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching social graph data:', error);
    return NextResponse.json({ error: 'Failed to fetch social graph data' }, { status: 500 });
  }
}
