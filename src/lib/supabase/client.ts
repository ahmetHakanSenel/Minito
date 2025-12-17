import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

/**
 * Supabase client configuration
 * 
 * Set these environment variables in your .env file:
 * - EXPO_PUBLIC_SUPABASE_URL
 * - EXPO_PUBLIC_SUPABASE_ANON_KEY
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Fail-soft: If Supabase is not configured, use valid placeholder values to prevent crashes
// The app will still work in offline mode with fallback content
// Using a valid URL format to satisfy Supabase client validation
const safeSupabaseUrl = supabaseUrl || 'https://placeholder.supabase.co';
const safeSupabaseAnonKey = supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.placeholder';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables. App will work in offline mode.'
  );
}

/**
 * Supabase client instance
 * Use this for database queries from the frontend
 * Fail-soft: If credentials are missing, client will be created with placeholder values
 * but API calls will fail gracefully and use offline fallback
 */
export const supabase = createClient(safeSupabaseUrl, safeSupabaseAnonKey, {
  auth: {
    persistSession: true, // Enable session persistence for authenticated users
    autoRefreshToken: true,
    detectSessionInUrl: false, // Not needed for mobile apps
  },
});

/**
 * Get the active system prompt
 * Returns the prompt that has is_active = true
 */
export async function getActiveSystemPrompt(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('system_prompts')
      .select('prompt_text')
      .eq('is_active', true)
      .single();

    if (error) {
      console.warn('Failed to fetch active system prompt:', error);
      return null;
    }

    const promptText = (data as { prompt_text?: string } | null)?.prompt_text ?? null;
    return promptText;
  } catch (error) {
    console.warn('Error fetching system prompt:', error);
    return null;
  }
}

/**
 * Insert a task record (for analytics/logging)
 * Fail-soft: errors are logged but don't block the request
 */
export async function insertTask(task: Database['public']['Tables']['tasks']['Insert']): Promise<void> {
  try {
    const { error } = await supabase.from('tasks').insert(task as any);
    if (error) {
      console.warn('Failed to insert task record:', error);
      // Fail-soft: don't throw, just log
    }
  } catch (error) {
    console.warn('Error inserting task:', error);
    // Fail-soft: don't throw
  }
}

