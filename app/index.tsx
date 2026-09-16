import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LogOut, X } from 'lucide-react-native';
import { TaskInput, OfflineBanner, MinitoIcon } from '../src/components';
import { HeaderUserWidget } from '../src/components/layout';
import { DashboardModal } from '../src/modals';
import { useAuth } from '../src/features/auth/controller/AuthContext';
import { DisplayNameEditor } from '../src/features/auth/ui/DisplayNameEditor';
import { useSystemHealth } from '../src/features/health/controller/useSystemHealth';
import { ServiceNotice } from '../src/features/health/ui/ServiceNotice';
import { useTaskBreakdowns } from '../src/features/tasks/controller/useTaskBreakdowns';
import { BreakdownProgress } from '../src/features/tasks/ui/BreakdownProgress';
import { TaskHistoryList } from '../src/features/tasks/ui/TaskHistoryList';
import type { BreakdownContent, TaskBreakdown } from '../src/repositories/taskRepository';
import {
  focusRoute,
  historyRoute,
  type FocusLaunchOptions,
} from '../src/features/tasks/focusLaunch';
import { confirmDeleteBreakdown } from '../src/features/tasks/ui/confirmDeleteBreakdown';
import { haptics } from '../src/lib/ui/haptics';
import { useKeepAboveKeyboard } from '../src/lib/ui/useKeepAboveKeyboard';
import { FallbackReason } from '../src/safety';
import {
  loadActiveSession,
  clearActiveSession,
  type ActiveSession,
} from '../src/lib/storage/activeSessionStore';

export { RouteErrorBoundary as ErrorBoundary } from '../src/components/feedback/RouteErrorBoundary';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user, displayName, signOut, updateDisplayName } = useAuth();
  const { items, hasMore, historyStatus, isBreakingDown, refresh, breakDown, remove } =
    useTaskBreakdowns();
  const {
    snapshot: healthSnapshot,
    isChecking: isCheckingHealth,
    refresh: refreshHealth,
  } = useSystemHealth();
  const [input, setInput] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [isDashboardVisible, setIsDashboardVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isNamePromptDismissed, setIsNamePromptDismissed] = useState(false);
  const [resumableSession, setResumableSession] = useState<ActiveSession | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams<{ openDashboard?: string }>();
  const insets = useSafeAreaInsets();
  const lastHapticTime = useRef<number>(0);
  const scrollRef = useRef<ScrollView>(null);
  const nameEditorRef = useRef<View>(null);
  const taskInputAreaRef = useRef<View>(null);
  // Points at whichever input area currently owns the keyboard.
  const keyboardTargetRef = useRef<View | null>(null);
  const keyboardScroll = useKeepAboveKeyboard(scrollRef, keyboardTargetRef);

  const showNameEditor = isEditingName || (!displayName && !isNamePromptDismissed);
  const menuName = displayName ?? user?.email ?? t('dashboard.guest');

  // Returning from focus mode changes the resumable session, task progress and possibly
  // connectivity, so everything the dashboard shows is re-checked on focus.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadActiveSession().then((session) => {
        if (!cancelled) setResumableSession(session);
      });
      refresh();
      refreshHealth();
      return () => {
        cancelled = true;
      };
    }, [refresh, refreshHealth])
  );

  const handleSignOut = async () => {
    haptics.press();
    setIsSigningOut(true);
    try {
      // The root auth guard redirects to /login once the session is cleared.
      await signOut();
    } catch {
      setIsSigningOut(false);
      haptics.error();
      Alert.alert(t('common.error'), t('errors.signOutFailed'));
    }
  };

  const openNameEditor = () => {
    haptics.selection();
    setIsEditingName(true);
  };

  const closeNameEditor = () => {
    Keyboard.dismiss();
    setIsEditingName(false);
    setIsNamePromptDismissed(true);
  };

  const saveDisplayName = async (name: string) => {
    await updateDisplayName(name);
    Keyboard.dismiss();
    setIsEditingName(false);
    setIsNamePromptDismissed(true);
  };

  const openFocus = (content: BreakdownContent, options?: FocusLaunchOptions) => {
    router.push(focusRoute(content, options));
  };

  const handleResumeSession = () => {
    if (!resumableSession) return;
    haptics.press();
    openFocus(
      {
        title: resumableSession.input,
        steps: resumableSession.steps,
        empathyBridge: resumableSession.empathyBridge,
        firstStepHook: resumableSession.firstStepHook,
        stoppingPoint: resumableSession.stoppingPoint ?? null,
      },
      {
        taskId: resumableSession.taskId,
        resumeStepIndex: resumableSession.currentStepIndex,
        requestId: resumableSession.requestId,
      }
    );
  };

  const handleDismissSession = () => {
    haptics.tap();
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
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    keyboardScroll.onScroll(event);
    const now = Date.now();
    if (now - lastHapticTime.current > 300) {
      haptics.selection();
      lastHapticTime.current = now;
    }
  };

  const handleBreakdownFailure = (reason: FallbackReason) => {
    console.warn('Failed to break task:', reason);
    if (reason === FallbackReason.DB_DOWN || reason === FallbackReason.AI_DOWN) {
      setIsOffline(true);
      return;
    }
    haptics.error();
    Alert.alert(
      t('common.error'),
      reason === FallbackReason.RATE_DOWN ? t('tasks.rateLimited') : t('errors.unknown')
    );
  };

  const handleBreakTask = async () => {
    const trimmed = input.trim();
    if (!trimmed || isBreakingDown) return;

    Keyboard.dismiss();
    setIsOffline(false);
    try {
      const outcome = await breakDown(trimmed);
      if (outcome.status === 'flagged') {
        // Panic screen renders its own localized content — no params needed
        router.push('/panic');
        return;
      }
      if (outcome.status === 'failed') {
        handleBreakdownFailure(outcome.reason);
        return;
      }
      haptics.success();
      setIsOffline(outcome.isOffline);
      setInput('');
      openFocus(outcome.content, {
        taskId: outcome.saved?.id,
        requestId: outcome.requestId ?? undefined,
      });
    } catch (error) {
      console.error('Error breaking task:', error);
      setIsOffline(true);
    }
  };

  const handleOpenBreakdown = (item: TaskBreakdown) => {
    haptics.selection();
    router.push(historyRoute(item));
  };

  const handleDeleteBreakdown = (item: TaskBreakdown) => {
    confirmDeleteBreakdown(t, () => remove(item.id));
  };

  const handleSeeAllHistory = () => {
    haptics.tap();
    router.push('/history');
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
        userName={menuName}
        isPremium={false}
        onNavigate={handleDashboardNavigate}
      />

      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <ScrollView
          ref={scrollRef}
          style={styles.screen}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 96,
            paddingHorizontal: 20,
          }}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          onLayout={keyboardScroll.onLayout}
          scrollEventThrottle={16}
        >
          <View className="flex-row items-center justify-between mb-6">
            <View className="flex-1 mr-4">
              <Text className="text-textMuted text-sm">{t('dashboard.welcome')}</Text>
              {displayName ? (
                <TouchableOpacity
                  onPress={openNameEditor}
                  accessibilityRole="button"
                  accessibilityHint={t('profile.editHint')}
                >
                  <Text className="text-textMain text-xl font-semibold mt-0.5" numberOfLines={1}>
                    {displayName}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={openNameEditor} accessibilityRole="button">
                  <Text className="text-primary text-base font-semibold mt-0.5">
                    {t('profile.addName')}
                  </Text>
                </TouchableOpacity>
              )}
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

          <ServiceNotice
            snapshot={healthSnapshot}
            isChecking={isCheckingHealth}
            onRetry={refreshHealth}
          />

          {showNameEditor && (
            <View ref={nameEditorRef} collapsable={false} className="mb-6">
              <DisplayNameEditor
                initialValue={displayName ?? ''}
                autoFocus={isEditingName}
                onSave={saveDisplayName}
                onClose={closeNameEditor}
                onFocus={() => {
                  keyboardTargetRef.current = nameEditorRef.current;
                }}
              />
            </View>
          )}

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

              <View ref={taskInputAreaRef} collapsable={false}>
                <TaskInput
                  value={input}
                  onChangeText={setInput}
                  onSubmit={handleBreakTask}
                  isLoading={isBreakingDown}
                  onFocus={() => {
                    keyboardTargetRef.current = taskInputAreaRef.current;
                  }}
                />
              </View>

              {isBreakingDown ? (
                <BreakdownProgress />
              ) : (
                <TaskHistoryList
                  items={items}
                  status={historyStatus}
                  hasMore={hasMore}
                  onOpen={handleOpenBreakdown}
                  onDelete={handleDeleteBreakdown}
                  onRetry={refresh}
                  onSeeAll={handleSeeAllHistory}
                />
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
