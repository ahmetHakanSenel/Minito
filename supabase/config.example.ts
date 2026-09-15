/**
 * Supabase Configuration Example
 *
 * Copy this file to supabase/config.ts and fill in your actual values.
 * Never commit supabase/config.ts to version control!
 */

export const supabaseConfig = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  // Edge function URL (usually: https://<project-ref>.supabase.co/functions/v1/break-task)
  edgeFunctionUrl: process.env.EXPO_PUBLIC_SUPABASE_EDGE_FUNCTION_URL || '',
};
