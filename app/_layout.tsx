import 'react-native-get-random-values';
import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/lib/auth';
import { I18nProvider } from '../src/lib/i18n/I18nProvider';
import { AuroraBackground } from '../src/components';
import { FloatingMiniPlayer } from '../src/components/audio';
import { AuroraProvider } from '../src/lib/aurora';
import { AudioProvider } from '../src/context';
import '../global.css';
import { initSentry } from '../src/lib/monitoring/sentry';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

// Initialize Sentry (async, but we don't block on it)
initSentry().catch((error) => {
  console.warn('Sentry initialization error:', error);
});

export default function RootLayout() {
  // Configure Android navigation bar to match app theme
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('#050510');
      NavigationBar.setButtonStyleAsync('light');
    }
  }, []);

  return (
    <SafeAreaProvider style={styles.safeArea}>
      <AudioProvider>
        <AuroraProvider>
          <View style={styles.container}>
            {/* Global Aurora Background - visible across all screens */}
            <AuroraBackground />

            <I18nProvider>
              <AuthProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: 'transparent', flex: 1 },
                    animation: 'fade',
                  }}
                >
                  <Stack.Screen name="index" />
                  <Stack.Screen name="focus" options={{ presentation: 'fullScreenModal' }} />
                  <Stack.Screen name="success" />
                  <Stack.Screen name="panic" options={{ presentation: 'fullScreenModal' }} />
                  <Stack.Screen name="planner" />
                  <Stack.Screen name="sounds" />
                  <Stack.Screen name="stats" />
                  <Stack.Screen name="settings" />
                  <Stack.Screen name="login" />
                  <Stack.Screen name="privacy" />
                </Stack>
              </AuthProvider>
            </I18nProvider>

            {/* Global Floating Mini Player - persistent across screens */}
            <FloatingMiniPlayer />
          </View>
        </AuroraProvider>
      </AudioProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#050510',
  },
});
