export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      planner_projects: {
        Row: {
          client_updated_at: string
          color: string
          created_at: string
          deleted_at: string | null
          due_date: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_updated_at: string
          color: string
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          id: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          client_updated_at?: string
          color?: string
          created_at?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      planner_tasks: {
        Row: {
          client_updated_at: string
          created_at: string
          deleted_at: string | null
          id: string
          is_completed: boolean
          position: number
          project_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_updated_at: string
          created_at?: string
          deleted_at?: string | null
          id: string
          is_completed?: boolean
          position?: number
          project_id: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          client_updated_at?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_completed?: boolean
          position?: number
          project_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_tasks_project_id_user_id_fkey"
            columns: ["project_id", "user_id"]
            isOneToOne: false
            referencedRelation: "planner_projects"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      task_breakdowns: {
        Row: {
          completed_at: string | null
          completed_step_count: number
          created_at: string
          empathy_bridge: string | null
          first_step_hook: string | null
          id: string
          steps: Json
          stopping_point: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_step_count?: number
          created_at?: string
          empathy_bridge?: string | null
          first_step_hook?: string | null
          id?: string
          steps: Json
          stopping_point?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          completed_step_count?: number
          created_at?: string
          empathy_bridge?: string | null
          first_step_hook?: string | null
          id?: string
          steps?: Json
          stopping_point?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          ai_latency_ms: number | null
          ai_model: string | null
          breakdown_source: string | null
          cached_token_usage: number | null
          completion_token_usage: number | null
          created_at: string
          fallback_reason: string | null
          feedback_at: string | null
          feedback_score: string | null
          finish_reason: string | null
          id: string
          input_hash: string
          language_match: boolean | null
          latency_ms: number | null
          prompt_token_usage: number | null
          prompt_version: string | null
          request_id: string | null
          response_language: string | null
          steps: Json | null
          token_usage: number | null
          user_id: string | null
          validation_issues: Json | null
        }
        Insert: {
          ai_latency_ms?: number | null
          ai_model?: string | null
          breakdown_source?: string | null
          cached_token_usage?: number | null
          completion_token_usage?: number | null
          created_at?: string
          fallback_reason?: string | null
          feedback_at?: string | null
          feedback_score?: string | null
          finish_reason?: string | null
          id?: string
          input_hash: string
          language_match?: boolean | null
          latency_ms?: number | null
          prompt_token_usage?: number | null
          prompt_version?: string | null
          request_id?: string | null
          response_language?: string | null
          steps?: Json | null
          token_usage?: number | null
          user_id?: string | null
          validation_issues?: Json | null
        }
        Update: {
          ai_latency_ms?: number | null
          ai_model?: string | null
          breakdown_source?: string | null
          cached_token_usage?: number | null
          completion_token_usage?: number | null
          created_at?: string
          fallback_reason?: string | null
          feedback_at?: string | null
          feedback_score?: string | null
          finish_reason?: string | null
          id?: string
          input_hash?: string
          language_match?: boolean | null
          latency_ms?: number | null
          prompt_token_usage?: number | null
          prompt_version?: string | null
          request_id?: string | null
          response_language?: string | null
          steps?: Json | null
          token_usage?: number | null
          user_id?: string | null
          validation_issues?: Json | null
        }
        Relationships: []
      }
      translations: {
        Row: {
          created_at: string
          id: string
          key: string
          language_code: string
          namespace: string | null
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          language_code: string
          namespace?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          language_code?: string
          namespace?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_consume_quota: {
        Args: {
          p_identifier: string
          p_max_requests: number
          p_window_interval: string
        }
        Returns: boolean
      }
      cleanup_old_tasks: { Args: never; Returns: number }
      cleanup_planner_tombstones: {
        Args: { p_older_than?: string }
        Returns: number
      }
      cleanup_rate_limits: { Args: { p_older_than?: string }; Returns: number }
      submit_breakdown_feedback: {
        Args: { p_request_id: string; p_score: string }
        Returns: boolean
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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

