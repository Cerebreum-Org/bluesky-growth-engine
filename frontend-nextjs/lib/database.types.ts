
export type Database = {
  public: {
    Tables: {
      bluesky_users: {
        Row: {
          did: string;
          handle: string;
          display_name: string | null;
          avatar: string | null;
          description: string | null;
          viewer_following: boolean | null;
          viewer_followed_by: boolean | null;
          followers_count: number | null;
          following_count: number | null;
          posts_count: number | null;
          indexed_at: string | null;
          updated_at: string | null;
        };
        Insert: Partial<{
          did: string;
          handle: string;
          display_name: string | null;
          avatar: string | null;
          description: string | null;
          viewer_following: boolean | null;
          viewer_followed_by: boolean | null;
          followers_count: number | null;
          following_count: number | null;
          posts_count: number | null;
          indexed_at: string | null;
          updated_at: string | null;
        }>;
        Update: Partial<{
          did: string;
          handle: string;
          display_name: string | null;
          avatar: string | null;
          description: string | null;
          viewer_following: boolean | null;
          viewer_followed_by: boolean | null;
          followers_count: number | null;
          following_count: number | null;
          posts_count: number | null;
          indexed_at: string | null;
          updated_at: string | null;
        }>;
        Relationships: [];
      };
      bluesky_posts: {
        Row: {
          uri: string;
          text: string | null;
          author_did: string;
          created_at: string;
          indexed_at: string | null;
        };
        Insert: Partial<{
          uri: string;
          text: string | null;
          author_did: string;
          created_at: string;
          indexed_at: string | null;
        }>;
        Update: Partial<{
          uri: string;
          text: string | null;
          author_did: string;
          created_at: string;
          indexed_at: string | null;
        }>;
        Relationships: [];
      };
      bluesky_likes: {
        Row: {
          uri: string;
          author_did: string;
          subject_uri: string;
          created_at: string;
          indexed_at: string | null;
        };
        Insert: Partial<{
          uri: string;
          author_did: string;
          subject_uri: string;
          created_at: string;
          indexed_at: string | null;
        }>;
        Update: Partial<{
          uri: string;
          author_did: string;
          subject_uri: string;
          created_at: string;
          indexed_at: string | null;
        }>;
        Relationships: [];
      };
      bluesky_reposts: {
        Row: {
          uri: string;
          author_did: string;
          subject_uri: string;
          created_at: string;
          indexed_at: string | null;
        };
        Insert: Partial<{
          uri: string;
          author_did: string;
          subject_uri: string;
          created_at: string;
          indexed_at: string | null;
        }>;
        Update: Partial<{
          uri: string;
          author_did: string;
          subject_uri: string;
          created_at: string;
          indexed_at: string | null;
        }>;
        Relationships: [];
      };
      bluesky_follows: {
        Row: {
          indexed_at: string | null;
        };
        Insert: Partial<{
          indexed_at: string | null;
        }>;
        Update: Partial<{
          indexed_at: string | null;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
