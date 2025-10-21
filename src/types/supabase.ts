export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      backfill_checkpoints: {
        Row: {
          collected_follows: number
          collected_likes: number
          collected_posts: number
          collected_reposts: number
          id: string
          last_processed_index: number
          processed_users: number
          updated_at: string
        }
        Insert: {
          collected_follows?: number
          collected_likes?: number
          collected_posts?: number
          collected_reposts?: number
          id: string
          last_processed_index?: number
          processed_users?: number
          updated_at?: string
        }
        Update: {
          collected_follows?: number
          collected_likes?: number
          collected_posts?: number
          collected_reposts?: number
          id?: string
          last_processed_index?: number
          processed_users?: number
          updated_at?: string
        }
        Relationships: []
      }
      bluesky_blocks: {
        Row: {
          author_did: string
          created_at: string
          indexed_at: string
          subject_did: string
          uri: string
        }
        Insert: {
          author_did: string
          created_at: string
          indexed_at?: string
          subject_did: string
          uri: string
        }
        Update: {
          author_did?: string
          created_at?: string
          indexed_at?: string
          subject_did?: string
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "bluesky_blocks_author_did_fkey"
            columns: ["author_did"]
            isOneToOne: false
            referencedRelation: "bluesky_users"
            referencedColumns: ["did"]
          },
        ]
      }
      bluesky_likes: {
        Row: {
          author_did: string
          created_at: string
          indexed_at: string
          subject_cid: string
          subject_uri: string
          uri: string
        }
        Insert: {
          author_did: string
          created_at: string
          indexed_at?: string
          subject_cid: string
          subject_uri: string
          uri: string
        }
        Update: {
          author_did?: string
          created_at?: string
          indexed_at?: string
          subject_cid?: string
          subject_uri?: string
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "bluesky_likes_author_did_fkey"
            columns: ["author_did"]
            isOneToOne: false
            referencedRelation: "bluesky_users"
            referencedColumns: ["did"]
          },
        ]
      }
      bluesky_list_items: {
        Row: {
          cid: string
          created_at: string
          indexed_at: string
          list_uri: string
          subject_did: string
          uri: string
        }
        Insert: {
          cid: string
          created_at: string
          indexed_at?: string
          list_uri: string
          subject_did: string
          uri: string
        }
        Update: {
          cid?: string
          created_at?: string
          indexed_at?: string
          list_uri?: string
          subject_did?: string
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "bluesky_list_items_list_uri_fkey"
            columns: ["list_uri"]
            isOneToOne: false
            referencedRelation: "bluesky_lists"
            referencedColumns: ["uri"]
          },
          {
            foreignKeyName: "bluesky_list_items_subject_did_fkey"
            columns: ["subject_did"]
            isOneToOne: false
            referencedRelation: "bluesky_users"
            referencedColumns: ["did"]
          },
        ]
      }
      bluesky_lists: {
        Row: {
          author_did: string
          cid: string
          created_at: string
          description: string | null
          indexed_at: string
          name: string
          purpose: string
          updated_at: string
          uri: string
        }
        Insert: {
          author_did: string
          cid: string
          created_at: string
          description?: string | null
          indexed_at?: string
          name: string
          purpose: string
          updated_at?: string
          uri: string
        }
        Update: {
          author_did?: string
          cid?: string
          created_at?: string
          description?: string | null
          indexed_at?: string
          name?: string
          purpose?: string
          updated_at?: string
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "bluesky_lists_author_did_fkey"
            columns: ["author_did"]
            isOneToOne: false
            referencedRelation: "bluesky_users"
            referencedColumns: ["did"]
          },
        ]
      }
      bluesky_posts: {
        Row: {
          author_did: string
          cid: string
          created_at: string
          embed_type: string | null
          embed_uri: string | null
          indexed_at: string
          is_quote_post: boolean | null
          like_count: number | null
          quote_chain_root: string | null
          quote_count: number | null
          quote_target_author: string | null
          quote_target_uri: string | null
          reply_count: number | null
          reply_parent: string | null
          reply_root: string | null
          repost_count: number | null
          text: string | null
          updated_at: string
          uri: string
        }
        Insert: {
          author_did: string
          cid: string
          created_at: string
          embed_type?: string | null
          embed_uri?: string | null
          indexed_at?: string
          is_quote_post?: boolean | null
          like_count?: number | null
          quote_chain_root?: string | null
          quote_count?: number | null
          quote_target_author?: string | null
          quote_target_uri?: string | null
          reply_count?: number | null
          reply_parent?: string | null
          reply_root?: string | null
          repost_count?: number | null
          text?: string | null
          updated_at?: string
          uri: string
        }
        Update: {
          author_did?: string
          cid?: string
          created_at?: string
          embed_type?: string | null
          embed_uri?: string | null
          indexed_at?: string
          is_quote_post?: boolean | null
          like_count?: number | null
          quote_chain_root?: string | null
          quote_count?: number | null
          quote_target_author?: string | null
          quote_target_uri?: string | null
          reply_count?: number | null
          reply_parent?: string | null
          reply_root?: string | null
          repost_count?: number | null
          text?: string | null
          updated_at?: string
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "bluesky_posts_author_did_fkey"
            columns: ["author_did"]
            isOneToOne: false
            referencedRelation: "bluesky_users"
            referencedColumns: ["did"]
          },
        ]
      }
      bluesky_profile_updates: {
        Row: {
          did: string
          field_name: string
          id: number
          new_value: string | null
          old_value: string | null
          updated_at: string
        }
        Insert: {
          did: string
          field_name: string
          id?: number
          new_value?: string | null
          old_value?: string | null
          updated_at?: string
        }
        Update: {
          did?: string
          field_name?: string
          id?: number
          new_value?: string | null
          old_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bluesky_profile_updates_did_fkey"
            columns: ["did"]
            isOneToOne: false
            referencedRelation: "bluesky_users"
            referencedColumns: ["did"]
          },
        ]
      }
      bluesky_quote_chains: {
        Row: {
          chain_length: number
          created_at: string
          id: number
          indexed_at: string
          participants: string[] | null
          root_post_author: string
          root_post_uri: string
          total_engagement: number | null
          updated_at: string
        }
        Insert: {
          chain_length?: number
          created_at?: string
          id?: number
          indexed_at?: string
          participants?: string[] | null
          root_post_author: string
          root_post_uri: string
          total_engagement?: number | null
          updated_at?: string
        }
        Update: {
          chain_length?: number
          created_at?: string
          id?: number
          indexed_at?: string
          participants?: string[] | null
          root_post_author?: string
          root_post_uri?: string
          total_engagement?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      bluesky_reposts: {
        Row: {
          author_did: string
          created_at: string
          indexed_at: string
          subject_cid: string
          subject_uri: string
          uri: string
        }
        Insert: {
          author_did: string
          created_at: string
          indexed_at?: string
          subject_cid: string
          subject_uri: string
          uri: string
        }
        Update: {
          author_did?: string
          created_at?: string
          indexed_at?: string
          subject_cid?: string
          subject_uri?: string
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "bluesky_reposts_author_did_fkey"
            columns: ["author_did"]
            isOneToOne: false
            referencedRelation: "bluesky_users"
            referencedColumns: ["did"]
          },
        ]
      }
      bluesky_users: {
        Row: {
          avatar_blob_cid: string | null
          avatar_blob_mime_type: string | null
          banner_blob_cid: string | null
          banner_blob_mime_type: string | null
          created_at: string | null
          description: string | null
          did: string
          display_name: string | null
          follower_count: number | null
          following_count: number | null
          handle: string | null
          indexed_at: string
          post_count: number | null
          updated_at: string
        }
        Insert: {
          avatar_blob_cid?: string | null
          avatar_blob_mime_type?: string | null
          banner_blob_cid?: string | null
          banner_blob_mime_type?: string | null
          created_at?: string | null
          description?: string | null
          did: string
          display_name?: string | null
          follower_count?: number | null
          following_count?: number | null
          handle?: string | null
          indexed_at?: string
          post_count?: number | null
          updated_at?: string
        }
        Update: {
          avatar_blob_cid?: string | null
          avatar_blob_mime_type?: string | null
          banner_blob_cid?: string | null
          banner_blob_mime_type?: string | null
          created_at?: string | null
          description?: string | null
          did?: string
          display_name?: string | null
          follower_count?: number | null
          following_count?: number | null
          handle?: string | null
          indexed_at?: string
          post_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

