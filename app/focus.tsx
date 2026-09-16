import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StatusBar, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
// Gesture-aware, so the step timer's dial can take a vertical drag from the page.
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, SlideOutRight, LinearTransition } from 'react-native-reanimated';
import { ArrowRight, Sparkles } from 'lucide-react-native';
import { FocusCard, PremiumStepAnimation, ConfettiAnimation, InlineTimer } from '../src/components';
import { STEP_CELEBRATION_MS } from '../src/components/PremiumStepAnimation';
import { parseTimeFromStep } from '../src/lib/timeParser';
import { normalizeSteps, type BreakdownStep } from '../src/lib/breakdownSteps';
import { useAuroraContext } from '../src/lib/aurora';
import { saveActiveSession, clearActiveSession } from '../src/lib/storage/activeSessionStore';
import { recordFocusSession } from '../src/lib/stats/sessionStore';
import { useTaskProgressSync } from '../src/features/tasks/controller/useTaskProgressSync';
import { haptics } from '../src/lib/ui/haptics';

const AnimatedView = Animated.createAnimatedComponent(View);

// An explicit duration in the step's text wins; otherwise the model's estimate timeboxes the step.
function stepDuration(step: BreakdownStep) {
  return (
    parseTimeFromStep(`${step.title} ${step.instruction}`) ??
    (step.estimatedMinutes ? { minutes: step.estimatedMinutes, seconds: 0 } : null)
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '../src/components/feedback/RouteErrorBoundary';

export default function FocusModeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { setCompletionPulse } = useAuroraContext();
  const params = useLocalSearchParams<{
    steps: string;
    input: string;
    empathyBridge?: string;
    firstStepHook?: string;
    stoppingPoint?: string;
    requestId?: string;
    resumeStepIndex?: string;
    taskId?: string;
  }>();
  // Restoring a saved session skips the empathy intro and jumps to the step
  const initialStepIndex = params.resumeStepIndex
    ? Math.max(0, parseInt(params.resumeStepIndex, 10) || 0)
    : -1;
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex); // -1 = empathy/hook screen
  const { syncProgress, markCompleted } = useTaskProgressSync(
    params.taskId,
    Math.max(0, initialStepIndex)
  );
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showStepAnimation, setShowStepAnimation] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [timerCompletionLoop, setTimerCompletionLoop] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nextTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // A timer's completion pulse belongs to the step that produced it. If the
  // user advances/goes back without pressing that timer's own stop control,
  // the InlineTimer instance unmounts but nothing else told the pulse to
  // stop — it would otherwise drive the Aurora background forever. Leaving
  // a step is always the authoritative "pulse over" signal.
  useEffect(() => {
    setTimerCompletionLoop(false);
  }, [currentStepIndex]);

  // A malformed param must degrade to the empty state, never crash the screen
  const steps: BreakdownStep[] = (() => {
    if (!params.steps) return [];
    try {
      return normalizeSteps(JSON.parse(params.steps));
    } catch (error) {
      console.warn('focus: failed to parse steps param', error);
      return [];
    }
  })();
  const empathyBridge = params.empathyBridge || '';
  const firstStepHook = params.firstStepHook || '';
  const stoppingPoint = params.stoppingPoint || '';
  const hasEmpathyScreen = empathyBridge || firstStepHook;
  const totalSteps = steps.length;

  // Persist progress so an OS kill (user left to actually do the step —
  // the core use case) never loses the session
  useEffect(() => {
    if (steps.length === 0) return;
    saveActiveSession({
      input: params.input || '',
      steps,
      empathyBridge,
      firstStepHook,
      stoppingPoint,
      requestId: params.requestId,
      currentStepIndex: Math.max(0, currentStepIndex),
      completedSteps: [...completedSteps],
      taskId: params.taskId,
    });
    // Standing on step N means steps 0..N-1 are done.
    syncProgress(Math.max(0, currentStepIndex));
    // Saves on progress only. `steps` and the texts are parsed from route params on every render,
    // so listing them would save on every render instead; they do not change while mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex, completedSteps, steps.length]);

  // Timer completion state with Aurora background pulse. The timer owns its
  // local loop; FocusMode is the only owner of the global Aurora state.
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      setCompletionPulse(timerCompletionLoop);
    });
    return () => cancelAnimationFrame(rafId);
  }, [timerCompletionLoop, setCompletionPulse]);

  useEffect(() => {
    // Haptic feedback on mount
    haptics.tap();

    // If no empathy screen, start at step 0
    if (!hasEmpathyScreen) {
      setCurrentStepIndex(0);
    }
  }, [hasEmpathyScreen]);

  const handleNext = () => {
    // From empathy screen (-1) to first step (0)
    if (currentStepIndex === -1) {
      setCurrentStepIndex(0);
      haptics.press();
      return;
    }

    if (currentStepIndex < totalSteps - 1) {
      // Clear any existing next timeout
      if (nextTimeoutRef.current) {
        clearTimeout(nextTimeoutRef.current);
        nextTimeoutRef.current = null;
      }

      // Mark current step as completed
      setCompletedSteps(new Set([...completedSteps, currentStepIndex]));

      // Ensure previous animation is cleared before starting new one
      // PremiumStepAnimation will handle cleanup when visible becomes false
      setShowStepAnimation(false);

      // Use requestAnimationFrame to ensure state update is processed
      // before starting new animation
      requestAnimationFrame(() => {
        setShowStepAnimation(true);
        haptics.success();

        // Hide the celebration and show the next step in the same update, so the old step never
        // flashes back in between.
        nextTimeoutRef.current = setTimeout(() => {
          setShowStepAnimation(false);
          setCurrentStepIndex(currentStepIndex + 1);
          haptics.selection();
          nextTimeoutRef.current = null;
        }, STEP_CELEBRATION_MS);
      });
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      haptics.tap();
    }
  };

  const handleComplete = () => {
    // Mark as completed
    setCompletedSteps(new Set([...completedSteps, currentStepIndex]));

    // For final step: NO tick animation, only confetti
    setShowStepAnimation(false); // Don't show tick animation
    setShowConfetti(true); // Trigger confetti explosion

    // Fire the success pattern at the moment of explosion
    haptics.success();

    // Navigation will be handled by ConfettiAnimation's onComplete callback
    // after both cannons finish their animations
  };

  const handleConfettiComplete = async () => {
    // Navigate to success screen when confetti animation completes
    setShowConfetti(false);

    // Session finished — nothing left to restore
    clearActiveSession();
    markCompleted(totalSteps);

    // Log the completed step-flow for the Insights screen
    recordFocusSession({
      durationSec: 0, // step flows are untimed; they count toward continuity, not focus minutes
      pickupCount: 0,
      completed: true,
      source: 'steps',
      stepsCompleted: totalSteps,
    });

    try {
      router.replace({
        pathname: '/success',
        params: {
          totalSteps: totalSteps.toString(),
          input: params.input || '',
          // Carried through so the finished session can be scored where it ends.
          ...(params.requestId ? { requestId: params.requestId } : {}),
        },
      });
    } catch (error) {
      console.warn('Navigation error:', error);
    }
  };

  // Cleanup timeouts on unmount. These refs hold timer ids, not nodes: reading them at unmount
  // is the point, because the latest pending timer is the one to cancel.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        clearTimeout(timeoutRef.current);
      }
      if (nextTimeoutRef.current) {
        clearTimeout(nextTimeoutRef.current);
      }
    };
  }, []);

  if (steps.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t('home.noSteps')}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Empathy/Hook intro screen (currentStepIndex === -1)
  const isEmpathyScreen = currentStepIndex === -1 && hasEmpathyScreen;

  // Clamped so the intro index (-1) and a stale resume index both land on a real step.
  const currentStep = steps[Math.min(Math.max(currentStepIndex, 0), totalSteps - 1)];
  const currentDuration = stepDuration(currentStep);
  const isCompleted = currentStepIndex >= 0 && completedSteps.has(currentStepIndex);

  const isFinalStep = currentStepIndex === totalSteps - 1;
  const isAnimating = showStepAnimation || showConfetti;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />
      {/* Confetti animation for final step only - triggers on Focus Screen */}
      {isFinalStep && (
        <ConfettiAnimation
          visible={showConfetti}
          onAnimationStart={() => {
            // Haptics are already triggered in handleComplete
            // This callback is here for potential future use
          }}
          onComplete={handleConfettiComplete}
        />
      )}
      {/* Premium step completion animation - NOT for final step */}
      {!isFinalStep && (
        <PremiumStepAnimation
          visible={showStepAnimation}
          completedCount={currentStepIndex + 1}
          totalSteps={totalSteps}
        />
      )}
      {/* NO ADS ALLOWED in Focus Mode - Core Law */}
      {isEmpathyScreen ? (
        /* Empathy Bridge + First Step Hook Screen */
        <AnimatedView
          key="empathy-screen"
          entering={FadeInDown.springify().damping(12).mass(0.8).stiffness(150)}
          style={styles.contentContainer}
        >
          <ScrollView
            contentContainerStyle={[
              styles.introScrollContent,
              { paddingHorizontal: Math.max(20, Math.min(32, width * 0.08)) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.empathyContainer}>
              <View style={styles.introKicker}>
                <Sparkles size={15} color="#C4B5FD" strokeWidth={2} />
                <Text style={styles.introKickerText}>{t('focus.startWith')}</Text>
              </View>
              {empathyBridge ? (
                <View style={styles.empathyCard}>
                  <Text style={styles.empathyText}>{empathyBridge}</Text>
                </View>
              ) : null}

              {firstStepHook ? (
                <View style={styles.hookCard}>
                  <Text style={styles.hookLabel}>{t('focus.next')}</Text>
                  <Text style={styles.hookText}>{firstStepHook}</Text>
                </View>
              ) : null}

              <View style={styles.introHint}>
                <Text style={styles.introHintText}>
                  {t('focus.step', { current: 1, total: totalSteps })}
                </Text>
              </View>

              <Animated.View
                entering={FadeInDown.delay(300).springify()}
                style={styles.readyButtonWrap}
              >
                <Pressable
                  onPress={handleNext}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.readyButton,
                    pressed && styles.readyButtonPressed,
                  ]}
                >
                  <Text style={styles.readyButtonText}>{t('focus.ready')}</Text>
                  <ArrowRight size={19} color="#FFFFFF" strokeWidth={2.5} />
                </Pressable>
              </Animated.View>
            </View>
          </ScrollView>
        </AnimatedView>
      ) : (
        /* Regular Step Card */
        <AnimatedView
          key={currentStepIndex}
          entering={FadeInDown.duration(220)}
          exiting={SlideOutRight.duration(220)}
          layout={LinearTransition.duration(220)}
          style={styles.contentContainer}
        >
          <ScrollView
            contentContainerStyle={styles.stepScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.stepWrapper}>
              <FocusCard
                step={currentStep}
                stoppingPoint={isFinalStep ? stoppingPoint : undefined}
                stepNumber={currentStepIndex + 1}
                totalSteps={totalSteps}
                onNext={handleNext}
                onPrevious={currentStepIndex > 0 ? handlePrevious : undefined}
                onComplete={currentStepIndex === totalSteps - 1 ? handleComplete : undefined}
                isCompleted={isCompleted}
                isFinalStep={isFinalStep}
                disabled={isAnimating}
                timerCompletionLoop={timerCompletionLoop}
                timerSlot={
                  currentDuration ? (
                    <InlineTimer
                      initialMinutes={currentDuration.minutes}
                      initialSeconds={currentDuration.seconds}
                      onCompletionStateChange={setTimerCompletionLoop}
                    />
                  ) : undefined
                }
              />
            </View>
          </ScrollView>
        </AnimatedView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  emptyCard: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    borderRadius: 24,
    backgroundColor: 'rgba(18,18,30,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emptyText: {
    color: '#E5E5E5',
    fontSize: 17,
    lineHeight: 25,
    textAlign: 'center',
  },
  introScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  empathyContainer: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    alignItems: 'stretch',
    gap: 14,
  },
  introKicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 8,
  },
  introKickerText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  empathyCard: {
    padding: 22,
    borderRadius: 24,
    backgroundColor: 'rgba(139,92,246,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  empathyText: {
    color: '#F4F4F5',
    fontSize: 21,
    lineHeight: 30,
    textAlign: 'center',
    fontWeight: '600',
  },
  hookCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  hookLabel: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  hookText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'center',
    fontWeight: '500',
  },
  introHint: {
    alignItems: 'center',
    marginTop: 6,
  },
  introHintText: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 13,
  },
  readyButtonWrap: {
    marginTop: 8,
  },
  readyButton: {
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#7C3AED',
  },
  readyButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  readyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  stepScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 22,
  },
  stepWrapper: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
});
