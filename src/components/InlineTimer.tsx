import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type DimensionValue } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Check, Pause, Play, RotateCcw, Square } from 'lucide-react-native';
import { DurationWheels } from './time/DurationWheels';
import { haptics } from '../lib/ui/haptics';

interface InlineTimerProps {
  initialMinutes: number;
  initialSeconds: number;
  onComplete?: () => void;
  onCompletionStateChange?: (isInCompletionLoop: boolean) => void;
}

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// The dial has no hours wheel: a micro-step that needs an hour is not a micro-step.
const MAX_TIMER_SECONDS = 59 * 60 + 59;

export const InlineTimer: React.FC<InlineTimerProps> = ({
  initialMinutes,
  initialSeconds,
  onComplete,
  onCompletionStateChange,
}) => {
  const { t } = useTranslation();
  const initialTotal = Math.max(0, initialMinutes * 60 + initialSeconds);
  // What the countdown runs from. Starts as the step's own estimate; setting a time replaces it,
  // so progress and reset always refer to the time the person actually chose.
  const [plannedTotal, setPlannedTotal] = useState(initialTotal);
  const [remaining, setRemaining] = useState(initialTotal);
  const [isRunning, setIsRunning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCompletionLoop, setIsCompletionLoop] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionHapticRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completionHandledRef = useRef(false);

  const actionScale = useSharedValue(1);
  const completionPulse = useSharedValue(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearCompletionFeedback = useCallback(() => {
    if (completionHapticRef.current) {
      clearInterval(completionHapticRef.current);
      completionHapticRef.current = null;
    }
    completionTimeoutsRef.current.forEach((id) => clearTimeout(id));
    completionTimeoutsRef.current = [];
    cancelAnimation(completionPulse);
    completionPulse.value = 0;
  }, [completionPulse]);

  useEffect(() => {
    return () => {
      clearTimer();
      clearCompletionFeedback();
    };
  }, [clearTimer, clearCompletionFeedback]);

  useEffect(() => {
    clearTimer();
    clearCompletionFeedback();
    completionHandledRef.current = false;
    setPlannedTotal(initialTotal);
    setRemaining(initialTotal);
    setIsRunning(false);
    setIsEditing(false);
    setIsCompletionLoop(false);
  }, [clearCompletionFeedback, clearTimer, initialTotal]);

  const tripleHapticBurst = useCallback(() => {
    haptics.commit();
    completionTimeoutsRef.current.push(
      setTimeout(() => haptics.commit(), 180),
      setTimeout(() => haptics.commit(), 360)
    );
  }, []);

  const handleComplete = useCallback(() => {
    if (completionHandledRef.current) return;
    completionHandledRef.current = true;
    clearTimer();
    setIsRunning(false);
    setIsCompletionLoop(true);
    onCompletionStateChange?.(true);
    tripleHapticBurst();
    completionPulse.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    completionHapticRef.current = setInterval(tripleHapticBurst, 3000);
  }, [clearTimer, completionPulse, onCompletionStateChange, tripleHapticBurst]);

  useEffect(() => {
    if (!isRunning || remaining > 0) return;
    handleComplete();
  }, [handleComplete, isRunning, remaining]);

  const handleStart = () => {
    if (isCompletionLoop || isRunning || plannedTotal <= 0) return;
    setIsEditing(false);
    if (remaining <= 0) {
      completionHandledRef.current = false;
      setRemaining(plannedTotal);
    }
    setIsRunning(true);
    haptics.tap();
    timerRef.current = setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);
  };

  const handlePause = () => {
    clearTimer();
    setIsRunning(false);
    haptics.selection();
  };

  const handleReset = () => {
    clearTimer();
    clearCompletionFeedback();
    completionHandledRef.current = false;
    setIsRunning(false);
    setIsCompletionLoop(false);
    setRemaining(plannedTotal);
    onCompletionStateChange?.(false);
    haptics.tap();
  };

  const handleStopCompletion = () => {
    clearCompletionFeedback();
    setIsCompletionLoop(false);
    onCompletionStateChange?.(false);
    haptics.press();
    onComplete?.();
  };

  // Setting a time is a new plan: it replaces the countdown and its total together.
  const setPlan = (seconds: number) => {
    if (isRunning || isCompletionLoop) return;
    const next = Math.max(0, Math.min(seconds, MAX_TIMER_SECONDS));
    completionHandledRef.current = false;
    setPlannedTotal(next);
    setRemaining(next);
  };

  const adjustTime = (deltaMinutes: number) => setPlan(remaining + deltaMinutes * 60);

  const toggleEditing = () => {
    if (isRunning || isCompletionLoop) return;
    haptics.selection();
    setIsEditing((current) => !current);
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress =
    plannedTotal > 0 ? Math.min(1, Math.max(0, (plannedTotal - remaining) / plannedTotal)) : 0;
  const progressWidth: DimensionValue = `${progress * 100}%`;
  const actionStyle = useAnimatedStyle(() => ({
    transform: [{ scale: actionScale.value }],
  }));
  const completionStyle = useAnimatedStyle(() => ({
    opacity: isCompletionLoop ? 0.12 + completionPulse.value * 0.16 : 0,
  }));

  return (
    <AnimatedView
      entering={FadeInDown.duration(260)}
      exiting={FadeOutDown.duration(180)}
      style={styles.container}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, styles.completionGlow, completionStyle]}
      />

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>
          {isCompletionLoop ? t('timer.completed') : t('timer.title')}
        </Text>
        {isCompletionLoop ? <Check size={16} color="#6EE7B7" strokeWidth={2.5} /> : null}
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <TouchableOpacity
        onPress={toggleEditing}
        disabled={isRunning || isCompletionLoop}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityHint={t('timer.editHint')}
      >
        <Text style={[styles.timeText, isCompletionLoop && styles.timeTextComplete]}>
          {formatTime(remaining)}
        </Text>
        {!isRunning && !isCompletionLoop && !isEditing ? (
          <Text style={styles.editHint}>{t('timer.tapToSet')}</Text>
        ) : null}
      </TouchableOpacity>

      {isCompletionLoop ? (
        <View style={styles.completionState}>
          <Text style={styles.completionMessage}>{t('timer.tapToStop')}</Text>
          <AnimatedTouchableOpacity
            style={[styles.stopButton, actionStyle]}
            onPress={handleStopCompletion}
            onPressIn={() => {
              actionScale.value = withSpring(0.96);
            }}
            onPressOut={() => {
              actionScale.value = withSpring(1);
            }}
          >
            <Square size={17} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2.3} />
            <Text style={styles.stopButtonText}>{t('timer.tapToStop')}</Text>
          </AnimatedTouchableOpacity>
        </View>
      ) : isEditing ? (
        <View style={styles.editor}>
          <DurationWheels value={remaining} onChange={setPlan} />
          <TouchableOpacity
            style={styles.doneButton}
            onPress={toggleEditing}
            accessibilityRole="button"
          >
            <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.mainButtonText}>{t('timer.done')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.iconButton, (isRunning || remaining <= 0) && styles.disabledControl]}
              onPress={() => adjustTime(-1)}
              disabled={isRunning || remaining <= 0}
              accessibilityLabel={t('timer.decrease')}
            >
              <Text style={styles.adjustText}>−</Text>
            </TouchableOpacity>

            <AnimatedTouchableOpacity
              style={[styles.mainButton, isRunning && styles.pauseButton, actionStyle]}
              onPress={isRunning ? handlePause : handleStart}
              onPressIn={() => {
                actionScale.value = withSpring(0.95);
              }}
              onPressOut={() => {
                actionScale.value = withSpring(1);
              }}
              disabled={plannedTotal <= 0}
              accessibilityRole="button"
            >
              {isRunning ? (
                <Pause size={20} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2.4} />
              ) : (
                <Play size={20} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2.4} />
              )}
              <Text style={styles.mainButtonText}>
                {isRunning ? t('timer.pause') : t('timer.start')}
              </Text>
            </AnimatedTouchableOpacity>

            <TouchableOpacity
              style={[styles.iconButton, isRunning && styles.disabledControl]}
              onPress={() => adjustTime(1)}
              // Adding time is always possible, even from zero.
              disabled={isRunning}
              accessibilityLabel={t('timer.increase')}
            >
              <Text style={styles.adjustText}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <RotateCcw size={14} color="rgba(255,255,255,0.48)" strokeWidth={2} />
            <Text style={styles.resetText}>{t('timer.reset')}</Text>
          </TouchableOpacity>
        </>
      )}
    </AnimatedView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    paddingTop: 2,
  },
  completionGlow: {
    borderRadius: 20,
    backgroundColor: '#34D399',
  },
  statusRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  statusLabel: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#A78BFA',
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 48,
    lineHeight: 58,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
    marginTop: 18,
  },
  timeTextComplete: {
    color: '#6EE7B7',
  },
  editHint: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.35)',
  },
  editor: {
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
    gap: 14,
  },
  doneButton: {
    minHeight: 42,
    paddingHorizontal: 20,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
  },
  controls: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  disabledControl: {
    opacity: 0.3,
  },
  adjustText: {
    color: '#E4E4E7',
    fontSize: 25,
    lineHeight: 28,
    fontWeight: '400',
  },
  mainButton: {
    minWidth: 126,
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
  },
  pauseButton: {
    backgroundColor: '#6D28D9',
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 13,
    padding: 5,
  },
  resetText: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 12,
    fontWeight: '600',
  },
  completionState: {
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  completionMessage: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  stopButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
