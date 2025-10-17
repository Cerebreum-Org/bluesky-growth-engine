import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_KEY');
}
// Default client with 30 second timeout
export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: false,
  },
  global: {
    headers: {
      'x-client-info': 'bluesky-growth-engine',
    },
  },
});

// Client with extended timeout for bulk operations (5 minutes)
export const supabaseBulk = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: false,
  },
  global: {
    headers: {
      'x-client-info': 'bluesky-growth-engine',
    },
  },
});

export interface BlueskyUser {
  did: string;
  handle: string;
  display_name?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
  labels?: unknown; // AT Protocol labels array
  associated?: unknown; // Associated data (verified links, etc.)
  viewer_muted?: boolean;
  viewer_blocked_by?: boolean;
  viewer_blocking?: boolean;
  viewer_following?: boolean;
  viewer_followed_by?: boolean;
  created_at?: string;
  indexed_at: string;
  updated_at: string;
}

export interface BlueskyFollow {
  follower_did: string;
  following_did: string;
  created_at: string;
  updated_at: string;
}
