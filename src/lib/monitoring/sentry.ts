import * as Sentry from '@sentry/react-native';

let initialized = false;

/**
 * Initialize Sentry (no-op if DSN missing or already initialized).
 * Uses public DSN env var per project tracker (privacy-safe).
 */
export async function initSentry(): Promise<void> {
  if (initialized) return;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    console.warn('Sentry DSN not set (EXPO_PUBLIC_SENTRY_DSN). Skipping Sentry init.');
    return;
  }

  try {
    Sentry.init({
      dsn,
      debug: false,
      sampleRate: 0.1, // error events: 10% sampling
      tracesSampleRate: 0.05, // quota-saving: 5% perf sampling
      ignoreErrors: [
        'Network request failed',
        'Network Error',
        'User cancelled',
        'TaskCancelledError',
        'AbortError',
        'The operation was cancelled',
      ],
    });

    initialized = true;
  } catch (error) {
    console.warn('Sentry init failed, continuing without Sentry:', error);
  }
}

