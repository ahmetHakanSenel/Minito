import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StatusBar, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';
import { TaskInput, OfflineBanner, MinitoIcon } from '../src/components';
import { HeaderUserWidget } from '../src/components/layout';
import { DashboardModal } from '../src/modals';
import { breakTask } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
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
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isDashboardVisible, setIsDashboardVisible] = useState(false);
  const [resumableSession, setResumableSession] = useState<ActiveSession | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams<{ openDashboard?: string }>();
  const insets = useSafeAreaInsets();
  const lastHapticTime = useRef<number>(0);

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
      // Clear the param to prevent reopening on re-render
      router.setParams({ openDashboard: undefined });
    }
  }, [params.openDashboard]);

  // GOD MODE: Selection haptic on scroll/swipe (debounced to avoid spam)
  const handleScroll = () => {
    const now = Date.now();
    // Only trigger haptic every 300ms to avoid overwhelming
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
      // All inputs go to AI - timer will be shown in Focus screen if step contains time
      const guestId = await getOrCreateGuestId();
      const result = await breakTask(input.trim(), guestId);

      if (result.success && result.steps) {
        // Show offline banner if using fallback content
        if (result.isOfflineFallback) {
          setIsOffline(true);
        }

        // Navigate to focus mode with steps and neuro-companion data
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
        // Handle fallback cases - TypeScript now knows result is the failure type
        if (result.fallbackReason === FallbackReason.CONTENT_FLAGGED) {
          // Panic screen renders its own localized content — no params needed
          router.push('/panic');
        } else {
          // For DB_DOWN or AI_DOWN, try to show offline fallback as last resort
          if (
            result.fallbackReason === FallbackReason.DB_DOWN ||
            result.fallbackReason === FallbackReason.AI_DOWN
          ) {
            // This shouldn't happen if offline fallback worked, but just in case
            console.warn('Failed to break task:', result.fallbackReason);
            setIsOffline(true);
          } else {
            // Show error for other cases
            console.warn('Failed to break task:', result.fallbackReason);
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
    <View style={{ flex: 1, backgroundColor: 'transparent', zIndex: 10 }}>
      <StatusBar barStyle="light-content" />
      <OfflineBanner isVisible={isOffline} />

      {/* Header User Widget - Top Right */}
      <View style={[styles.headerWidget, { top: insets.top + 8 }]}>
        <HeaderUserWidget onPress={() => setIsDashboardVisible(true)} />
      </View>

      {/* Dashboard Modal */}
      <DashboardModal
        visible={isDashboardVisible}
        onClose={() => setIsDashboardVisible(false)}
        userName={
          (user?.user_metadata?.full_name as string) ||
          (user?.user_metadata?.name as string) ||
          user?.email?.split('@')[0] ||
          t('dashboard.guest')
        }
        isPremium={false}
        onNavigate={handleDashboardNavigate}
      />

      <View style={{ flex: 1, backgroundColor: 'transparent', zIndex: 10 }}>
        <ScrollView
          style={{ flex: 1, backgroundColor: 'transparent' }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingVertical: 40,
          }}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <View className="flex-1 justify-center px-4">
            <View className="items-center mb-4">
              <MinitoIcon size={80} color="#8B5CF6" />
            </View>

            {/* Resume interrupted session */}
            {resumableSession && (
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
            )}

            <TaskInput
              value={input}
              onChangeText={setInput}
              onSubmit={handleBreakTask}
              isLoading={isLoading}
            />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWidget: {
    position: 'absolute',
    right: 16,
    zIndex: 100,
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
