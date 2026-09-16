import 'react-native-get-random-values';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SplashScreen, Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as NavigationBar from 'expo-navigation-bar';
import { AuthProvider, useAuth } from '../src/features/auth/controller/AuthContext';
import { I18nProvider } from '../src/lib/i18n/I18nProvider';
import { AuroraBackground } from '../src/components';
import { FloatingAudioButton } from '../src/components/audio';
import { AuroraProvider } from '../src/lib/aurora';
import { AudioProvider } from '../src/context';
import { ProjectProvider } from '../src/context/ProjectContext';
import { initSentry } from '../src/lib/monitoring/sentry';
import { loadPreferences } from '../src/lib/storage/preferencesStore';
import { setHapticsEnabled } from '../src/lib/ui/haptics';
import '../global.css';

initSentry();

// Keep the splash up until the persisted session is restored, so the guard never flashes the wrong screen.
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, isInitializing } = useAuth();
  const isSignedIn = session !== null;

  useEffect(() => {
    if (!isInitializing) {
      SplashScreen.hideAsync();
    }
  }, [isInitializing]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent', flex: 1 },
        animation: 'fade',
      }}
    >
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="focus" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="success" />
        <Stack.Screen name="panic" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="planner" />
        <Stack.Screen name="sounds" />
        <Stack.Screen name="stats" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="history" />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '../src/components/feedback/RouteErrorBoundary';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setButtonStyleAsync('light');
    }
    // Until this resolves haptics stay on, which is also the default.
    loadPreferences()
      .then((preferences) => setHapticsEnabled(preferences.haptics))
      .catch(() => {});
  }, []);

  return (
    // Gestures (the time dials) need a gesture root at the top of the tree.
    <GestureHandlerRootView style={styles.safeArea}>
      <SafeAreaProvider style={styles.safeArea}>
        <AudioProvider>
          <AuroraProvider>
            <ProjectProvider>
              <View style={styles.container}>
                <AuroraBackground />

                <I18nProvider>
                  <AuthProvider>
                    <RootNavigator />
                  </AuthProvider>
                  <FloatingAudioButton />
                </I18nProvider>
              </View>
            </ProjectProvider>
          </AuroraProvider>
        </AudioProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
