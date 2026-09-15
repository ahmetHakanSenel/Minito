import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, SlideOutRight, LinearTransition } from 'react-native-reanimated';
import { FocusCard, PremiumStepAnimation, ConfettiAnimation, InlineTimer } from '../src/components';
import { parseTimeFromStep } from '../src/lib/timeParser';
import { useAuroraContext } from '../src/lib/aurora';
import { saveActiveSession, clearActiveSession } from '../src/lib/storage/activeSessionStore';
import { recordFocusSession } from '../src/lib/stats/sessionStore';
import { useTaskProgressSync } from '../src/features/tasks/controller/useTaskProgressSync';
import * as Haptics from 'expo-haptics';
// Ambient audio temporarily disabled until asset is added
// import { useAmbientAudio } from '../src/lib/audio/ambientAudio';

const AnimatedView = Animated.createAnimatedComponent(View);

export { RouteErrorBoundary as ErrorBoundary } from '../src/components/feedback/RouteErrorBoundary';

export default function FocusModeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setCompletionPulse } = useAuroraContext();
  const params = useLocalSearchParams<{
    steps: string;
    input: string;
    empathyBridge?: string;
    firstStepHook?: string;
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

  // GOD MODE: Neuro-Sonic Ambience - Brown noise with fade in/out
  // const { startAmbience, stopAmbience } = useAmbientAudio();

  // A malformed param must degrade to the empty state, never crash the screen
  const steps: string[] = (() => {
    if (!params.steps) return [];
    try {
      const parsed = JSON.parse(params.steps);
      return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
    } catch (error) {
      console.warn('focus: failed to parse steps param', error);
      return [];
    }
  })();
  const empathyBridge = params.empathyBridge || '';
  const firstStepHook = params.firstStepHook || '';
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
      currentStepIndex: Math.max(0, currentStepIndex),
      completedSteps: [...completedSteps],
      taskId: params.taskId,
    });
    // Standing on step N means steps 0..N-1 are done.
    syncProgress(Math.max(0, currentStepIndex));
  }, [currentStepIndex, completedSteps, steps.length]);

  // Sync timer completion state with Aurora background pulse
  useEffect(() => {
    // Use requestAnimationFrame to defer the update and avoid "Cannot update a component" warning
    const rafId = requestAnimationFrame(() => {
      setCompletionPulse(timerCompletionLoop);
    });
    return () => cancelAnimationFrame(rafId);
  }, [timerCompletionLoop, setCompletionPulse]);

  useEffect(() => {
    // Haptic feedback on mount
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // If no empathy screen, start at step 0
    if (!hasEmpathyScreen) {
      setCurrentStepIndex(0);
    }

    // GOD MODE: Start ambient audio on Focus Mode start (disabled until asset added)
    // startAmbience();

    // Cleanup: Stop ambient audio on unmount
    return () => {
      // stopAmbience();
    };
  }, [hasEmpathyScreen]);

  const handleNext = () => {
    // From empathy screen (-1) to first step (0)
    if (currentStepIndex === -1) {
      setCurrentStepIndex(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Move to next step after animation completes (wait for PremiumStepAnimation to finish)
        // PremiumStepAnimation duration is 2500ms for non-final steps
        nextTimeoutRef.current = setTimeout(() => {
          setShowStepAnimation(false);
          setCurrentStepIndex(currentStepIndex + 1);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          nextTimeoutRef.current = null;
        }, 2500); // Match PremiumStepAnimation duration
      });
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleComplete = () => {
    // Mark as completed
    setCompletedSteps(new Set([...completedSteps, currentStepIndex]));

    // For final step: NO tick animation, only confetti
    setShowStepAnimation(false); // Don't show tick animation
    setShowConfetti(true); // Trigger confetti explosion

    // Fire heavy haptics at the moment of explosion
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

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

    // GOD MODE: Fade out ambient audio before leaving Focus Mode (disabled)
    // await stopAmbience();

    try {
      router.replace({
        pathname: '/success',
        params: {
          totalSteps: totalSteps.toString(),
          input: params.input || '',
        },
      });
    } catch (error) {
      console.warn('Navigation error:', error);
    }
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
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
          <View className="bg-surface rounded-2xl p-6">
            <Text className="text-textMain text-lg text-center">{t('home.noSteps')}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Empathy/Hook intro screen (currentStepIndex === -1)
  const isEmpathyScreen = currentStepIndex === -1 && hasEmpathyScreen;

  const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex] : '';
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
          onComplete={() => setShowStepAnimation(false)}
          isFinalStep={false}
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
          <View style={styles.empathyContainer}>
            {/* Empathy Bridge */}
            {empathyBridge && (
              <View style={styles.empathyCard}>
                <Text style={styles.empathyText}>{empathyBridge}</Text>
              </View>
            )}

            {/* First Step Hook */}
            {firstStepHook && (
              <View style={styles.hookCard}>
                <Text style={styles.hookLabel}>{t('focus.startWith') || 'İlk adım:'}</Text>
                <Text style={styles.hookText}>{firstStepHook}</Text>
              </View>
            )}

            {/* Ready Button */}
            <Animated.View entering={FadeInDown.delay(300).springify()}>
              <View style={styles.readyButton}>
                <Text style={styles.readyButtonText} onPress={handleNext}>
                  {t('focus.ready') || 'Hazırım'}
                </Text>
              </View>
            </Animated.View>
          </View>
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
          <View style={styles.stepWrapper}>
            <FocusCard
              step={currentStep}
              stepNumber={currentStepIndex + 1}
              totalSteps={totalSteps}
              onNext={handleNext}
              onPrevious={currentStepIndex > 0 ? handlePrevious : undefined}
              onComplete={currentStepIndex === totalSteps - 1 ? handleComplete : undefined}
              isCompleted={isCompleted}
              isFinalStep={isFinalStep}
              disabled={isAnimating}
              timerCompletionLoop={timerCompletionLoop}
              timerSlot={(() => {
                const parsedTime = parseTimeFromStep(currentStep);
                if (parsedTime) {
                  return (
                    <InlineTimer
                      initialMinutes={parsedTime.minutes}
                      initialSeconds={parsedTime.seconds}
                      onCompletionStateChange={setTimerCompletionLoop}
                    />
                  );
                }
                return undefined;
              })()}
            />
          </View>
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
  // Empathy/Hook Screen Styles
  empathyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 24,
  },
  empathyCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  empathyText: {
    color: '#E5E5E5',
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  hookCard: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  hookLabel: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hookText: {
    color: '#E5E5E5',
    fontSize: 20,
    lineHeight: 30,
    textAlign: 'center',
    fontWeight: '500',
  },
  readyButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
    marginTop: 16,
  },
  readyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Step wrapper for FocusCard + InlineTimer
  stepWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
