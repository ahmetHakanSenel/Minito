import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import type { Database } from './database.types';
import { secureSessionStorage } from './secureSessionStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isBackendConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export class BackendUnavailableError extends Error {
  constructor() {
    super(
      'Supabase is not configured: EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing.'
    );
    this.name = 'BackendUnavailableError';
  }
}

type MinitoSupabaseClient = ReturnType<typeof createClient<Database>>;

const client: MinitoSupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: secureSessionStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

if (!client && __DEV__) {
  console.warn(
    'Supabase is not configured, so the app runs in offline mode. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.'
  );
}

/**
 * Returns the configured client, or throws BackendUnavailableError so callers can degrade to
 * an offline state instead of crashing at import time.
 */
export function getSupabase(): MinitoSupabaseClient {
  if (!client) {
    throw new BackendUnavailableError();
  }
  return client;
}

// Refresh timers are unreliable while a mobile app is backgrounded, so tie them to foreground state.
if (client && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      client.auth.startAutoRefresh();
    } else {
      client.auth.stopAutoRefresh();
    }
  });
}
