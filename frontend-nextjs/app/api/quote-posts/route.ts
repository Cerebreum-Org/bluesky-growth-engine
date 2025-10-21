import { NextResponse } from 'next/server';

export const revalidate = 60; // Cache for 1 minute

export async function GET() {
  try {
    // Mock data for quote posts
    const mockQuotePosts = [
      {
        id: '1',
        text: 'This is an amazing insight! Thanks for sharing.',
        author_did: 'did:plc:example1',
        created_at: new Date().toISOString(),
        like_count: 25,
        repost_count: 8,
        quoted_post: {
          text: 'Just discovered something incredible about Bluesky...',
          author_handle: 'original.author',
          author_display_name: 'Original Author'
        }
      },
      {
        id: '2', 
        text: 'Completely agree with this perspective.',
        author_did: 'did:plc:example2',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        like_count: 42,
        repost_count: 15,
        quoted_post: {
          text: 'The future of social media is decentralized.',
          author_handle: 'tech.expert',
          author_display_name: 'Tech Expert'
        }
      },
      {
        id: '3',
        text: 'This changes everything!',
        author_did: 'did:plc:example3', 
        created_at: new Date(Date.now() - 7200000).toISOString(),
        like_count: 18,
        repost_count: 6,
        quoted_post: {
          text: 'New features coming to Bluesky soon...',
          author_handle: 'bluesky.dev',
          author_display_name: 'Bluesky Developer'
        }
      }
    ];

    const mockAuthors = [
      { did: 'did:plc:example1', handle: 'user1.bsky.social', display_name: 'User One' },
      { did: 'did:plc:example2', handle: 'user2.bsky.social', display_name: 'User Two' },
      { did: 'did:plc:example3', handle: 'user3.bsky.social', display_name: 'User Three' }
    ];

    return NextResponse.json({
      success: true,
      data: {
        quote_posts: mockQuotePosts,
        authors: mockAuthors,
        total_count: mockQuotePosts.length
      }
    });

  } catch (error) {
    console.error('Error in quote posts API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
