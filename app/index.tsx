import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LogOut, X } from 'lucide-react-native';
import { TaskInput, OfflineBanner, MinitoIcon } from '../src/components';
import { HeaderUserWidget } from '../src/components/layout';
import { DashboardModal } from '../src/modals';
import { breakTask } from '../src/lib/api';
import { useAuth } from '../src/features/auth/controller/AuthContext';
import { getOrCreateGuestId } from '../src/lib/guestIdentity';
import { FallbackReason } from '../src/safety';
import {
  loadActiveSession,
  clearActiveSession,
  type ActiveSession,
} from '../src/lib/storage/activeSessionStore';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isDashboardVisible, setIsDashboardVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [resumableSession, setResumableSession] = useState<ActiveSession | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams<{ openDashboard?: string }>();
  const insets = useSafeAreaInsets();
  const lastHapticTime = useRef<number>(0);

  const displayName = user?.email ?? t('dashboard.guest');

  // Check for an interrupted focus session whenever home regains focus
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadActiveSession().then((session) => {
        if (!cancelled) setResumableSession(session);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSigningOut(true);
    try {
      // The root auth guard redirects to /login once the session is cleared.
      await signOut();
    } catch {
      setIsSigningOut(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), t('errors.signOutFailed'));
    }
  };

  const handleResumeSession = () => {
    if (!resumableSession) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/focus',
      params: {
        steps: JSON.stringify(resumableSession.steps),
        input: resumableSession.input,
        empathyBridge: resumableSession.empathyBridge,
        firstStepHook: resumableSession.firstStepHook,
        resumeStepIndex: String(resumableSession.currentStepIndex),
      },
    });
  };

  const handleDismissSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearActiveSession();
    setResumableSession(null);
  };

  // Open DashboardModal when coming back from sub-screens with openDashboard param
  useEffect(() => {
    if (params.openDashboard === 'true') {
      setIsDashboardVisible(true);
      router.setParams({ openDashboard: undefined });
    }
  }, [params.openDashboard]);

  // Selection haptic on scroll, debounced to avoid spam
  const handleScroll = () => {
    const now = Date.now();
    if (now - lastHapticTime.current > 300) {
      Haptics.selectionAsync();
      lastHapticTime.current = now;
    }
  };

  const handleBreakTask = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    setIsOffline(false);

    try {
      const guestId = await getOrCreateGuestId();
      const result = await breakTask(input.trim(), guestId);

      if (result.success && result.steps) {
        if (result.isOfflineFallback) {
          setIsOffline(true);
        }

        router.push({
          pathname: '/focus',
          params: {
            steps: JSON.stringify(result.steps),
            input: input.trim(),
            empathyBridge: result.empathyBridge || '',
            firstStepHook: result.firstStepHook || '',
          },
        });
      } else if (!result.success) {
        if (result.fallbackReason === FallbackReason.CONTENT_FLAGGED) {
          // Panic screen renders its own localized content — no params needed
          router.push('/panic');
        } else {
          console.warn('Failed to break task:', result.fallbackReason);
          if (
            result.fallbackReason === FallbackReason.DB_DOWN ||
            result.fallbackReason === FallbackReason.AI_DOWN
          ) {
            setIsOffline(true);
          }
        }
      }
    } catch (error) {
      console.error('Error breaking task:', error);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDashboardNavigate = (screen: string) => {
    switch (screen) {
      case 'planner':
        router.push('/planner');
        break;
      case 'sounds':
        router.push('/sounds');
        break;
      case 'stats':
        router.push('/stats');
        break;
      case 'settings':
        router.push('/settings');
        break;
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <OfflineBanner isVisible={isOffline} />

      <DashboardModal
        visible={isDashboardVisible}
        onClose={() => setIsDashboardVisible(false)}
        userName={displayName}
        isPremium={false}
        onNavigate={handleDashboardNavigate}
      />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View className="flex-row items-center justify-between mb-8">
          <View className="flex-1 mr-4">
            <Text className="text-textMuted text-sm">{t('dashboard.welcome')}</Text>
            <Text className="text-textMain text-xl font-semibold mt-0.5" numberOfLines={1}>
              {displayName}
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={handleSignOut}
              disabled={isSigningOut}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.signOut')}
              className={`flex-row items-center gap-2 h-11 px-4 rounded-full bg-white/10 border border-white/20 ${
                isSigningOut ? 'opacity-60' : ''
              }`}
            >
              {isSigningOut ? (
                <ActivityIndicator size="small" color="#E5E5E5" />
              ) : (
                <LogOut size={16} color="#E5E5E5" strokeWidth={2} />
              )}
              <Text className="text-textMain text-sm font-medium">{t('dashboard.signOut')}</Text>
            </TouchableOpacity>
            <HeaderUserWidget onPress={() => setIsDashboardVisible(true)} />
          </View>
        </View>

        <View className="flex-1 justify-center">
          <View className="items-center mb-6">
            <MinitoIcon size={64} color="#8B5CF6" />
          </View>

          <View className="rounded-3xl bg-white/5 border border-white/10 py-6">
            <View className="px-4 mb-5">
              <Text className="text-textMain text-lg font-semibold">
                {t('dashboard.coreFeatureTitle')}
              </Text>
              <Text className="text-textMuted text-sm mt-1">
                {t('dashboard.coreFeatureSubtitle')}
              </Text>
            </View>

            {resumableSession && (
              <View className="px-4">
                <TouchableOpacity
                  style={styles.resumeCard}
                  onPress={handleResumeSession}
                  activeOpacity={0.85}
                >
                  <View style={styles.resumeTextContainer}>
                    <Text style={styles.resumeTitle}>{t('home.resumeTitle')}</Text>
                    <Text style={styles.resumeSubtitle} numberOfLines={1}>
                      {resumableSession.input || t('home.resumeFallbackLabel')}
                    </Text>
                    <Text style={styles.resumeProgress}>
                      {t('focus.step', {
                        current: resumableSession.currentStepIndex + 1,
                        total: resumableSession.steps.length,
                      })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleDismissSession}
                    style={styles.resumeDismiss}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={16} color="#A1A1AA" />
                  </TouchableOpacity>
                </TouchableOpacity>
              </View>
            )}

            <TaskInput
              value={input}
              onChangeText={setInput}
              onSubmit={handleBreakTask}
              isLoading={isLoading}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderColor: 'rgba(139, 92, 246, 0.35)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  resumeTextContainer: {
    flex: 1,
  },
  resumeTitle: {
    color: '#C4B5FD',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  resumeSubtitle: {
    color: '#E5E5E5',
    fontSize: 15,
    fontWeight: '500',
  },
  resumeProgress: {
    color: '#A1A1AA',
    fontSize: 12,
    marginTop: 4,
  },
  resumeDismiss: {
    padding: 6,
  },
});
