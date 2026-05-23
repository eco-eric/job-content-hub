export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      company_profile: {
        Row: {
          company_name: string
          created_at: string
          differentiators: string[]
          service_area: string
          service_lines: Json
          standard_ctas: Json
          trade: string
          updated_at: string
          user_id: string
          voice_sample: string
        }
        Insert: {
          company_name?: string
          created_at?: string
          differentiators?: string[]
          service_area?: string
          service_lines?: Json
          standard_ctas?: Json
          trade?: string
          updated_at?: string
          user_id: string
          voice_sample?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          differentiators?: string[]
          service_area?: string
          service_lines?: Json
          standard_ctas?: Json
          trade?: string
          updated_at?: string
          user_id?: string
          voice_sample?: string
        }
        Relationships: []
      }
      content_items: {
        Row: {
          approved_at: string | null
          body_md: string
          channel: Database["public"]["Enums"]["content_channel"]
          exported_at: string | null
          generated_at: string
          id: string
          intent: Database["public"]["Enums"]["content_intent"]
          project_id: string
          status: Database["public"]["Enums"]["content_status"]
          title: string | null
          unresolved_confirms: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          body_md?: string
          channel: Database["public"]["Enums"]["content_channel"]
          exported_at?: string | null
          generated_at?: string
          id?: string
          intent: Database["public"]["Enums"]["content_intent"]
          project_id: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string | null
          unresolved_confirms?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          body_md?: string
          channel?: Database["public"]["Enums"]["content_channel"]
          exported_at?: string | null
          generated_at?: string
          id?: string
          intent?: Database["public"]["Enums"]["content_intent"]
          project_id?: string
          status?: Database["public"]["Enums"]["content_status"]
          title?: string | null
          unresolved_confirms?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_answers: {
        Row: {
          project_id: string
          question_key: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          project_id: string
          question_key: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          project_id?: string
          question_key?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "project_answers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          project_id: string
          storage_path: string
          tag: Database["public"]["Enums"]["photo_tag"]
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          project_id: string
          storage_path: string
          tag: Database["public"]["Enums"]["photo_tag"]
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          project_id?: string
          storage_path?: string
          tag?: Database["public"]["Enums"]["photo_tag"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          customer_type: string | null
          id: string
          service_line: string | null
          status: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at: string
          user_id: string
          worthiness_tag: Database["public"]["Enums"]["worthiness_tag"] | null
        }
        Insert: {
          created_at?: string
          customer_type?: string | null
          id?: string
          service_line?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          updated_at?: string
          user_id: string
          worthiness_tag?: Database["public"]["Enums"]["worthiness_tag"] | null
        }
        Update: {
          created_at?: string
          customer_type?: string | null
          id?: string
          service_line?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          updated_at?: string
          user_id?: string
          worthiness_tag?: Database["public"]["Enums"]["worthiness_tag"] | null
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
      content_channel: "seo_blog" | "facebook" | "instagram" | "case_study"
      content_intent: "educational" | "seo" | "social_proof" | "process"
      content_status: "draft" | "approved" | "exported"
      photo_tag: "before" | "after" | "process" | "detail"
      project_status: "triaging" | "interviewing" | "ready" | "archived"
      worthiness_tag:
        | "unusual_problem"
        | "dramatic_before_after"
        | "customer_stressed"
        | "taught_me_something"
        | "common_misconception"
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
  public: {
    Enums: {
      content_channel: ["seo_blog", "facebook", "instagram", "case_study"],
      content_intent: ["educational", "seo", "social_proof", "process"],
      content_status: ["draft", "approved", "exported"],
      photo_tag: ["before", "after", "process", "detail"],
      project_status: ["triaging", "interviewing", "ready", "archived"],
      worthiness_tag: [
        "unusual_problem",
        "dramatic_before_after",
        "customer_stressed",
        "taught_me_something",
        "common_misconception",
      ],
    },
  },
} as const
