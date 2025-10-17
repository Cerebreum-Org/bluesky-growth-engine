export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      bluesky_users: {
        Row: {
          did: string
          handle: string
          display_name: string | null
          description: string | null
          avatar: string | null
          banner: string | null
          followers_count: number | null
          following_count: number | null
          posts_count: number | null
          labels: Json | null
          associated: Json | null
          viewer_muted: boolean | null
          viewer_blocked_by: boolean | null
          viewer_blocking: boolean | null
          viewer_following: boolean | null
          viewer_followed_by: boolean | null
          created_at: string | null
          indexed_at: string
          updated_at: string
        }
        Insert: {
          did: string
          handle: string
          display_name?: string | null
          description?: string | null
          avatar?: string | null
          banner?: string | null
          followers_count?: number | null
          following_count?: number | null
          posts_count?: number | null
          labels?: Json | null
          associated?: Json | null
          viewer_muted?: boolean | null
          viewer_blocked_by?: boolean | null
          viewer_blocking?: boolean | null
          viewer_following?: boolean | null
          viewer_followed_by?: boolean | null
          created_at?: string | null
          indexed_at: string
          updated_at: string
        }
        Update: {
          did?: string
          handle?: string
          display_name?: string | null
          description?: string | null
          avatar?: string | null
          banner?: string | null
          followers_count?: number | null
          following_count?: number | null
          posts_count?: number | null
          labels?: Json | null
          associated?: Json | null
          viewer_muted?: boolean | null
          viewer_blocked_by?: boolean | null
          viewer_blocking?: boolean | null
          viewer_following?: boolean | null
          viewer_followed_by?: boolean | null
          created_at?: string | null
          indexed_at?: string
          updated_at?: string
        }
      }
      bluesky_follows: {
        Row: {
          follower_did: string
          following_did: string
          created_at: string
          updated_at: string
        }
        Insert: {
          follower_did: string
          following_did: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          follower_did?: string
          following_did?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
