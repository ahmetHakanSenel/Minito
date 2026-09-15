import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

let initialized = false;

/**
 * Initialize Sentry once. Without EXPO_PUBLIC_SENTRY_DSN monitoring stays off and
 * every helper below is a no-op.
 */
export function initSentry(): void {
  if (initialized) return;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    if (__DEV__) {
      console.info('Sentry disabled: EXPO_PUBLIC_SENTRY_DSN is not set.');
    }
    return;
  }

  const appConfig = Constants.expoConfig;
  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    release: `${appConfig?.slug ?? 'minito'}@${appConfig?.version ?? '0.0.0'}`,
    // Traffic is low, so keep every error event; sample performance traces to stay in quota.
    sampleRate: 1.0,
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
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
}

// Only the opaque user id is attached; email and display name never leave the device.
export function setMonitoringUser(userId: string | null): void {
  if (!initialized) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

export function captureException(error: unknown): void {
  if (!initialized) return;
  Sentry.captureException(error);
}
