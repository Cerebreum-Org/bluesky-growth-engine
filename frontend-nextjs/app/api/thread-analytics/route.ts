import { NextResponse } from 'next/server';

export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
  try {
    // Mock thread analytics data
    const mockThreadDepthStats = [
      { thread_depth: 1, count: 15420 },
      { thread_depth: 2, count: 8340 },
      { thread_depth: 3, count: 4210 },
      { thread_depth: 4, count: 1870 },
      { thread_depth: 5, count: 750 },
      { thread_depth: 6, count: 320 },
      { thread_depth: 7, count: 145 },
      { thread_depth: 8, count: 65 },
      { thread_depth: 9, count: 28 },
      { thread_depth: 10, count: 12 }
    ];

    const mockActiveThreads = [
      {
        id: 'thread1',
        root_post_text: 'What do you think about the future of decentralized social media?',
        root_author_handle: 'tech.thoughtleader',
        root_author_display_name: 'Tech Thought Leader',
        reply_count: 47,
        like_count: 156,
        repost_count: 32,
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'thread2',
        root_post_text: 'Just launched my new project! Check it out and let me know what you think.',
        root_author_handle: 'indie.dev',
        root_author_display_name: 'Indie Developer',
        reply_count: 38,
        like_count: 234,
        repost_count: 45,
        created_at: new Date(Date.now() - 7200000).toISOString()
      },
      {
        id: 'thread3',
        root_post_text: 'Breaking: Major changes coming to social media landscape...',
        root_author_handle: 'news.reporter',
        root_author_display_name: 'News Reporter',
        reply_count: 92,
        like_count: 523,
        repost_count: 187,
        created_at: new Date(Date.now() - 10800000).toISOString()
      }
    ];

    const mockLongestThreads = [
      {
        id: 'longthread1',
        root_post_text: 'A comprehensive analysis of modern social networks (1/25)',
        root_author_handle: 'academic.researcher',
        root_author_display_name: 'Academic Researcher',
        max_depth: 25,
        total_posts: 87,
        created_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'longthread2', 
        root_post_text: 'My journey building a startup - lessons learned (thread)',
        root_author_handle: 'startup.founder',
        root_author_display_name: 'Startup Founder',
        max_depth: 18,
        total_posts: 62,
        created_at: new Date(Date.now() - 172800000).toISOString()
      }
    ];

    const mockRecentThreads = [
      {
        id: 'recent1',
        root_post_text: 'Quick thought about the new Bluesky features...',
        root_author_handle: 'early.adopter',
        root_author_display_name: 'Early Adopter',
        created_at: new Date(Date.now() - 900000).toISOString(),
        reply_count: 5
      },
      {
        id: 'recent2',
        root_post_text: 'Does anyone have experience with decentralized protocols?',
        root_author_handle: 'curious.developer',
        root_author_display_name: 'Curious Developer', 
        created_at: new Date(Date.now() - 1800000).toISOString(),
        reply_count: 12
      }
    ];

    return NextResponse.json({
      success: true,
      data: {
        thread_depth_distribution: mockThreadDepthStats,
        most_active_threads: mockActiveThreads,
        longest_threads: mockLongestThreads,
        recent_threads: mockRecentThreads,
        stats: {
          total_threads_analyzed: 45230,
          average_thread_depth: 2.3,
          max_thread_depth: 25,
          active_threads_last_hour: 156
        }
      }
    });

  } catch (error) {
    console.error('Error in thread analytics API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
