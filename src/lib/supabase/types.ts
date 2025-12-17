/**
 * TypeScript types for Supabase database tables
 * These match the schema defined in supabase/migrations/001_initial_schema.sql
 */

export interface SystemPrompt {
  id: string;
  prompt_text: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  input_hash: string;
  guest_id: string | null;
  request_id: string | null;
  token_usage: number | null;
  latency_ms: number | null;
  fallback_reason: string | null;
  created_at: string;
}

export interface Translation {
  id: string;
  key: string;
  language_code: string;
  value: string;
  namespace: string;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      system_prompts: {
        Row: SystemPrompt;
        Insert: Omit<SystemPrompt, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<SystemPrompt, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, 'id' | 'created_at'>;
        Update: Partial<Omit<Task, 'id' | 'created_at'>>;
        Relationships: [];
      };
      translations: {
        Row: Translation;
        Insert: Omit<Translation, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Translation, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

