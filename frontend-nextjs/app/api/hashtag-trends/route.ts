import { NextResponse } from 'next/server';

export const revalidate = 30; // Cache for 30 seconds

export async function GET() {
  try {
    // For now, return mock data since the database structure isn't fully set up
    const mockTrendingNow = [
      { normalized_tag: 'bluesky', count: 150 },
      { normalized_tag: 'politics', count: 120 },
      { normalized_tag: 'art', count: 95 },
      { normalized_tag: 'music', count: 80 },
      { normalized_tag: 'technology', count: 65 }
    ];

    const mockTrending24h = [
      { normalized_tag: 'bluesky', count: 2400 },
      { normalized_tag: 'news', count: 1800 },
      { normalized_tag: 'politics', count: 1600 },
      { normalized_tag: 'art', count: 1200 },
      { normalized_tag: 'music', count: 1100 },
      { normalized_tag: 'technology', count: 950 },
      { normalized_tag: 'photography', count: 800 },
      { normalized_tag: 'books', count: 750 },
      { normalized_tag: 'science', count: 700 },
      { normalized_tag: 'gaming', count: 650 }
    ];

    const mockRecentActivity = [
      { id: 1, normalized_tag: 'bluesky', created_at: new Date().toISOString() },
      { id: 2, normalized_tag: 'technology', created_at: new Date(Date.now() - 60000).toISOString() },
      { id: 3, normalized_tag: 'art', created_at: new Date(Date.now() - 120000).toISOString() }
    ];

    return NextResponse.json({
      success: true,
      data: {
        trending_now: mockTrendingNow,
        trending_24h: mockTrending24h,
        recent_activity: mockRecentActivity
      }
    });

  } catch (error) {
    console.error('Error in hashtag trends API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
