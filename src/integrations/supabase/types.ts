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
      companies: {
        Row: {
          audience_tone_modifiers: Json
          channels_enabled: string[]
          created_at: string
          customer_types: string[]
          differentiators: string[]
          id: string
          name: string
          owner_user_id: string
          service_area: string[]
          service_lines: Json
          standard_ctas: Json
          trade: string
          updated_at: string
          voice_examples: Json
          voice_tone_keywords: string[]
        }
        Insert: {
          audience_tone_modifiers?: Json
          channels_enabled?: string[]
          created_at?: string
          customer_types?: string[]
          differentiators?: string[]
          id?: string
          name?: string
          owner_user_id: string
          service_area?: string[]
          service_lines?: Json
          standard_ctas?: Json
          trade?: string
          updated_at?: string
          voice_examples?: Json
          voice_tone_keywords?: string[]
        }
        Update: {
          audience_tone_modifiers?: Json
          channels_enabled?: string[]
          created_at?: string
          customer_types?: string[]
          differentiators?: string[]
          id?: string
          name?: string
          owner_user_id?: string
          service_area?: string[]
          service_lines?: Json
          standard_ctas?: Json
          trade?: string
          updated_at?: string
          voice_examples?: Json
          voice_tone_keywords?: string[]
        }
        Relationships: []
      }
      content_assets: {
        Row: {
          audience: string
          body: string
          channel: string
          created_at: string
          cta_id: string | null
          flagged_unknowns: Json
          generation_metadata: Json
          hashtags: string[]
          headline: string | null
          id: string
          intent_id: string
          length_variant: string
          project_id: string
          status: string
          suggested_media: string[]
          tone_overrides: string | null
          updated_at: string
          version_history: Json
        }
        Insert: {
          audience?: string
          body?: string
          channel: string
          created_at?: string
          cta_id?: string | null
          flagged_unknowns?: Json
          generation_metadata?: Json
          hashtags?: string[]
          headline?: string | null
          id?: string
          intent_id: string
          length_variant?: string
          project_id: string
          status?: string
          suggested_media?: string[]
          tone_overrides?: string | null
          updated_at?: string
          version_history?: Json
        }
        Update: {
          audience?: string
          body?: string
          channel?: string
          created_at?: string
          cta_id?: string | null
          flagged_unknowns?: Json
          generation_metadata?: Json
          hashtags?: string[]
          headline?: string | null
          id?: string
          intent_id?: string
          length_variant?: string
          project_id?: string
          status?: string
          suggested_media?: string[]
          tone_overrides?: string | null
          updated_at?: string
          version_history?: Json
        }
        Relationships: [
          {
            foreignKeyName: "content_assets_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "content_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_intents: {
        Row: {
          audience: string
          created_at: string
          id: string
          intent_type: string
          notes: Json
          project_id: string
          updated_at: string
        }
        Insert: {
          audience?: string
          created_at?: string
          id?: string
          intent_type: string
          notes?: Json
          project_id: string
          updated_at?: string
        }
        Update: {
          audience?: string
          created_at?: string
          id?: string
          intent_type?: string
          notes?: Json
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_intents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          project_id: string
          tag: string
          type: string
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          project_id: string
          tag: string
          type: string
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          project_id?: string
          tag?: string
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          before_state: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          customer_quote: string | null
          customer_type: string | null
          equipment_used: string[]
          homeowner_misconception: string | null
          id: string
          interview_state: Json
          lesson_learned: string | null
          location_city: string | null
          location_neighborhood: string | null
          location_region: string | null
          materials_used: string[]
          name: string
          outcome: string | null
          scope_performed: string | null
          service_line_id: string | null
          service_type_detail: string | null
          started_at: string | null
          status: string
          unusual_details: string | null
          updated_at: string
          worthiness_tag: string | null
        }
        Insert: {
          before_state?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          customer_quote?: string | null
          customer_type?: string | null
          equipment_used?: string[]
          homeowner_misconception?: string | null
          id?: string
          interview_state?: Json
          lesson_learned?: string | null
          location_city?: string | null
          location_neighborhood?: string | null
          location_region?: string | null
          materials_used?: string[]
          name?: string
          outcome?: string | null
          scope_performed?: string | null
          service_line_id?: string | null
          service_type_detail?: string | null
          started_at?: string | null
          status?: string
          unusual_details?: string | null
          updated_at?: string
          worthiness_tag?: string | null
        }
        Update: {
          before_state?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          customer_quote?: string | null
          customer_type?: string | null
          equipment_used?: string[]
          homeowner_misconception?: string | null
          id?: string
          interview_state?: Json
          lesson_learned?: string | null
          location_city?: string | null
          location_neighborhood?: string | null
          location_region?: string | null
          materials_used?: string[]
          name?: string
          outcome?: string | null
          scope_performed?: string | null
          service_line_id?: string | null
          service_type_detail?: string | null
          started_at?: string | null
          status?: string
          unusual_details?: string | null
          updated_at?: string
          worthiness_tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      user_owns_company: { Args: { _company_id: string }; Returns: boolean }
      user_owns_project: { Args: { _project_id: string }; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
