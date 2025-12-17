import 'react-native-get-random-values';
import * as Sentry from 'sentry-expo';

// Initialize Sentry (fail-soft: if DSN is not configured, Sentry will be disabled)
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    enableInExpoDevelopment: false, // Disable in development to avoid noise
    debug: false, // Set to true for debugging Sentry issues
    environment: __DEV__ ? 'development' : 'production',
    // Only capture errors in production
    beforeSend(event, hint) {
      // In development, log to console instead of sending to Sentry
      if (__DEV__) {
        console.warn('Sentry event (dev mode, not sent):', event);
        return null; // Don't send in dev
      }
      return event;
    },
  });
} else {
  console.warn(
    'Sentry DSN not configured. Set EXPO_PUBLIC_SENTRY_DSN in .env to enable error tracking.'
  );
}

import 'expo-router/entry';


