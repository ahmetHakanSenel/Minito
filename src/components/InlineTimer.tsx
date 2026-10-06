import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOutDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  BellOff,
  Check,
  Clock3,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
} from 'lucide-react-native';
import { DurationWheels } from './time/DurationWheels';
import { formatCountdown, secondsLeft } from '../lib/time/duration';
import { haptics } from '../lib/ui/haptics';
import { PRESS_SPRING } from '../lib/ui/motion';

interface InlineTimerProps {
  initialMinutes: number;
  initialSeconds: number;
  onComplete?: () => void;
  onCompletionStateChange?: (isInCompletionLoop: boolean) => void;
}

type Phase = 'ready' | 'running' | 'paused' | 'editing' | 'done';

// The dial has no hours wheel: a micro-step that needs an hour is not a micro-step.
const MAX_TIMER_SECONDS = 59 * 60 + 59;
const TICK_MS = 250;
// While the alarm is up, a burst every few seconds: noticeable across a room, not a siren.
const ALARM_REPEAT_MS = 3_000;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * The step timer. One surface, one primary action per state, and nothing written twice.
 *
 * Time is kept against an end timestamp, like the focus session, so a busy JS thread or a pause
 * can never make it drift.
 */
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
  const [phase, setPhase] = useState<Phase>('ready');

  const endAtRef = useRef(0);
  const alarmRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const burstRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const pressScale = useSharedValue(1);
  const alarmPulse = useSharedValue(0);

  const stopAlarm = useCallback(() => {
    if (alarmRef.current) clearInterval(alarmRef.current);
    alarmRef.current = null;
    burstRef.current.forEach(clearTimeout);
    burstRef.current = [];
    cancelAnimation(alarmPulse);
    alarmPulse.value = withTiming(0, { duration: 200 });
  }, [alarmPulse]);

  // A new step brings a new estimate: start over from it.
  useEffect(() => {
    stopAlarm();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new step brings a new estimate, so the timer restarts from it
    setPlannedTotal(initialTotal);
    setRemaining(initialTotal);
    setPhase('ready');
  }, [initialTotal, stopAlarm]);

  useEffect(() => stopAlarm, [stopAlarm]);

  const burst = useCallback(() => {
    haptics.commit();
    burstRef.current.push(
      setTimeout(() => haptics.commit(), 170),
      setTimeout(() => haptics.commit(), 340)
    );
  }, []);

  // The countdown, derived from the end timestamp on every tick.
  useEffect(() => {
    if (phase !== 'running') return;
    const tick = () => {
      const left = secondsLeft(endAtRef.current, Date.now());
      setRemaining(left);
      if (left === 0) {
        setPhase('done');
      }
    };
    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [phase]);

  // Entering and leaving the alarm, reported once per change rather than from inside a tick.
  useEffect(() => {
    if (phase !== 'done') return;
    onCompletionStateChange?.(true);
    burst();
    alarmRef.current = setInterval(burst, ALARM_REPEAT_MS);
    alarmPulse.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    return () => {
      stopAlarm();
      onCompletionStateChange?.(false);
    };
  }, [phase, burst, stopAlarm, alarmPulse, onCompletionStateChange]);

  const start = () => {
    if (plannedTotal <= 0) return;
    const from = remaining > 0 ? remaining : plannedTotal;
    endAtRef.current = Date.now() + from * 1000;
    setRemaining(from);
    setPhase('running');
    haptics.press();
  };

  const pause = () => {
    setRemaining(secondsLeft(endAtRef.current, Date.now()));
    setPhase('paused');
    haptics.selection();
  };

  const reset = () => {
    setRemaining(plannedTotal);
    setPhase('ready');
    haptics.tap();
  };

  const dismissAlarm = () => {
    haptics.press();
    setRemaining(plannedTotal);
    setPhase('ready');
    onComplete?.();
  };

  // Setting a time is a new plan: it replaces the countdown and its total together.
  const setPlan = (seconds: number) => {
    const next = Math.max(0, Math.min(seconds, MAX_TIMER_SECONDS));
    setPlannedTotal(next);
    setRemaining(next);
  };

  const nudge = (deltaMinutes: number) => {
    haptics.selection();
    setPlan(remaining + deltaMinutes * 60);
    if (phase === 'paused') setPhase('ready');
  };

  const openEditor = () => {
    haptics.selection();
    setPhase('editing');
  };

  const closeEditor = () => {
    haptics.tap();
    setPhase('ready');
  };

  const progress =
    plannedTotal > 0 ? Math.min(1, Math.max(0, (plannedTotal - remaining) / plannedTotal)) : 0;
  const isDone = phase === 'done';
  const canEdit = phase === 'ready' || phase === 'paused';

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));
  const alarmStyle = useAnimatedStyle(() => ({ opacity: alarmPulse.value }));
  const pressHandlers = {
    onPressIn: () => {
      pressScale.value = withSpring(0.96, PRESS_SPRING);
    },
    onPressOut: () => {
      pressScale.value = withSpring(1, PRESS_SPRING);
    },
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.headerLabel}>
        {isDone ? (
          <Check size={14} color="#6EE7B7" strokeWidth={2.6} />
        ) : (
          <Clock3 size={14} color="rgba(255,255,255,0.5)" strokeWidth={2.2} />
        )}
        <Text style={[styles.label, isDone && styles.labelDone]}>
          {isDone
            ? t('timer.timeUp')
            : phase === 'editing'
              ? t('timer.editTitle')
              : t('timer.title')}
        </Text>
      </View>
      {phase === 'paused' || (phase === 'ready' && remaining !== plannedTotal) ? (
        <TouchableOpacity
          onPress={reset}
          style={styles.resetButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('timer.reset')}
        >
          <RotateCcw size={14} color="rgba(255,255,255,0.6)" strokeWidth={2.2} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (phase === 'editing') {
    return (
      <Animated.View entering={FadeIn.duration(180)} style={styles.surface}>
        {header}
        <View style={styles.editor}>
          <DurationWheels value={remaining} onChange={setPlan} />
        </View>
        <TouchableOpacity
          style={[styles.primary, styles.primaryWide]}
          onPress={closeEditor}
          accessibilityRole="button"
        >
          <Check size={18} color="#FFFFFF" strokeWidth={2.6} />
          <Text style={styles.primaryText}>{t('timer.done')}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(240)}
      exiting={FadeOutDown.duration(160)}
      style={[styles.surface, isDone && styles.surfaceDone]}
    >
      {/* The alarm breathes through the surface's own border, so nothing spills outside it. */}
      <Animated.View pointerEvents="none" style={[styles.alarmRing, alarmStyle]} />

      {header}

      <TouchableOpacity
        onPress={openEditor}
        disabled={!canEdit}
        activeOpacity={0.7}
        style={styles.timeBlock}
        accessibilityRole={canEdit ? 'button' : 'timer'}
        accessibilityHint={canEdit ? t('timer.editHint') : undefined}
      >
        <Text
          style={[styles.time, phase === 'paused' && styles.timePaused, isDone && styles.timeDone]}
        >
          {formatCountdown(remaining)}
        </Text>
        {canEdit ? (
          <View style={styles.editChip}>
            <Pencil size={11} color="rgba(255,255,255,0.55)" strokeWidth={2.2} />
            <Text style={styles.editChipText}>{t('timer.adjust')}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            isDone && styles.fillDone,
            { width: `${(isDone ? 1 : progress) * 100}%` },
          ]}
        />
      </View>

      {isDone ? (
        <AnimatedTouchable
          entering={FadeIn.duration(200)}
          style={[styles.primary, styles.primaryWide, styles.primaryDone, pressStyle]}
          onPress={dismissAlarm}
          {...pressHandlers}
          accessibilityRole="button"
        >
          <BellOff size={18} color="#FFFFFF" strokeWidth={2.4} />
          <Text style={styles.primaryText}>{t('timer.stopAlarm')}</Text>
        </AnimatedTouchable>
      ) : (
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.nudge, phase === 'running' && styles.disabled]}
            onPress={() => nudge(-1)}
            disabled={phase === 'running' || remaining < 60}
            accessibilityRole="button"
            accessibilityLabel={t('timer.decrease')}
          >
            <Minus size={18} color="#E4E4E7" strokeWidth={2.2} />
          </TouchableOpacity>

          <AnimatedTouchable
            style={[styles.primary, phase === 'running' && styles.primaryRunning, pressStyle]}
            onPress={phase === 'running' ? pause : start}
            disabled={plannedTotal <= 0}
            {...pressHandlers}
            accessibilityRole="button"
          >
            {phase === 'running' ? (
              <Pause size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2.2} />
            ) : (
              <Play size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={2.2} />
            )}
            <Text style={styles.primaryText}>
              {phase === 'running'
                ? t('timer.pause')
                : phase === 'paused'
                  ? t('timer.resume')
                  : t('timer.start')}
            </Text>
          </AnimatedTouchable>

          <TouchableOpacity
            style={[styles.nudge, phase === 'running' && styles.disabled]}
            onPress={() => nudge(1)}
            // Adding time is always possible, even from zero.
            disabled={phase === 'running'}
            accessibilityRole="button"
            accessibilityLabel={t('timer.increase')}
          >
            <Plus size={18} color="#E4E4E7" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  surface: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  surfaceDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.07)',
    borderColor: 'rgba(52, 211, 153, 0.22)',
  },
  alarmRing: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(110, 231, 183, 0.8)',
  },
  header: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  labelDone: {
    color: '#6EE7B7',
  },
  resetButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  timeBlock: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 14,
  },
  time: {
    fontSize: 46,
    lineHeight: 54,
    fontWeight: '300',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  timePaused: {
    color: 'rgba(255, 255, 255, 0.55)',
  },
  timeDone: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  editChip: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  editChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.55)',
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#A78BFA',
  },
  fillDone: {
    backgroundColor: '#34D399',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nudge: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  disabled: {
    opacity: 0.35,
  },
  primary: {
    flex: 1,
    minHeight: 46,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
  },
  primaryWide: {
    flex: 0,
    alignSelf: 'stretch',
  },
  primaryRunning: {
    backgroundColor: 'rgba(124, 58, 237, 0.55)',
  },
  primaryDone: {
    backgroundColor: '#059669',
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  editor: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },
});
