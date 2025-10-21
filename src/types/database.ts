// Enhanced database types including quotes, blocks, lists
export interface BlueSkyPost {
  uri: string;
  cid: string;
  author_did: string;
  text: string;
  created_at: string;
  reply_parent?: string;
  reply_root?: string;
  like_count: number;
  repost_count: number;
  reply_count: number;
  quote_count: number;
  indexed_at: string;
  updated_at: string;
  // New quote fields
  is_quote_post?: boolean;
  quoted_post_uri?: string;
  quoted_author_did?: string;
  quote_depth?: number;
  quote_chain_root?: string;
}

export interface QuoteChain {
  root_uri: string;
  total_quotes: number;
  max_depth: number;
  chain_duration_hours?: number;
  indexed_at: string;
  updated_at: string;
}

export interface BlueSkyUser {
  did: string;
  handle?: string;
  display_name?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  indexed_at: string;
  updated_at: string;
}

export interface BlueSkyLike {
  uri: string;
  author_did: string;
  subject_uri: string;
  subject_cid: string;
  created_at: string;
}

export interface BlueSkyRepost {
  uri: string;
  author_did: string;
  subject_uri: string;
  subject_cid: string;
  created_at: string;
}

export interface BlueSkyFollow {
  uri: string;
  author_did: string;
  subject_did: string;
  created_at: string;
}

export interface BlueSkyBlock {
  uri: string;
  blocker_did: string;
  blocked_did: string;
  created_at: string;
  indexed_at: string;
}

export interface BlueSkyList {
  uri: string;
  creator_did: string;
  name: string;
  description?: string;
  purpose: string;
  avatar?: string;
  member_count: number;
  created_at: string;
  indexed_at: string;
  updated_at: string;
}

export interface BlueSkyListItem {
  uri: string;
  list_uri: string;
  subject_did: string;
  created_at: string;
  indexed_at: string;
}

export interface BlueSkyProfileHistory {
  id: number;
  user_did: string;
  display_name?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  labels?: any;
  change_type: string;
  previous_value?: string;
  created_at: string;
}

// Database schema type
export interface Database {
  public: {
    Tables: {
      bluesky_posts: {
        Row: BlueSkyPost;
        Insert: Omit<BlueSkyPost, 'indexed_at' | 'updated_at'> & {
          indexed_at?: string;
          updated_at?: string;
        };
        Update: Partial<BlueSkyPost>;
      };
      quote_chains: {
        Row: QuoteChain;
        Insert: Omit<QuoteChain, 'indexed_at' | 'updated_at'> & {
          indexed_at?: string;
          updated_at?: string;
        };
        Update: Partial<QuoteChain>;
      };
      bluesky_users: {
        Row: BlueSkyUser;
        Insert: Omit<BlueSkyUser, 'indexed_at' | 'updated_at'> & {
          indexed_at?: string;
          updated_at?: string;
        };
        Update: Partial<BlueSkyUser>;
      };
      bluesky_likes: {
        Row: BlueSkyLike;
        Insert: BlueSkyLike;
        Update: Partial<BlueSkyLike>;
      };
      bluesky_reposts: {
        Row: BlueSkyRepost;
        Insert: BlueSkyRepost;
        Update: Partial<BlueSkyRepost>;
      };
      bluesky_follows: {
        Row: BlueSkyFollow;
        Insert: BlueSkyFollow;
        Update: Partial<BlueSkyFollow>;
      };
      bluesky_blocks: {
        Row: BlueSkyBlock;
        Insert: Omit<BlueSkyBlock, 'indexed_at'> & {
          indexed_at?: string;
        };
        Update: Partial<BlueSkyBlock>;
      };
      bluesky_lists: {
        Row: BlueSkyList;
        Insert: Omit<BlueSkyList, 'indexed_at' | 'updated_at'> & {
          indexed_at?: string;
          updated_at?: string;
        };
        Update: Partial<BlueSkyList>;
      };
      bluesky_list_items: {
        Row: BlueSkyListItem;
        Insert: Omit<BlueSkyListItem, 'indexed_at'> & {
          indexed_at?: string;
        };
        Update: Partial<BlueSkyListItem>;
      };
      bluesky_profile_history: {
        Row: BlueSkyProfileHistory;
        Insert: Omit<BlueSkyProfileHistory, 'id' | 'created_at'> & {
          id?: number;
          created_at?: string;
        };
        Update: Partial<BlueSkyProfileHistory>;
      };
    };
  };
}
