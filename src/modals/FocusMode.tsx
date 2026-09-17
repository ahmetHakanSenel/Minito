import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pause, Play, Smartphone, X } from 'lucide-react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Accelerometer } from 'expo-sensors';
import { createPickupDetector, magnitude } from '../lib/focus/pickupDetector';
import { useTranslation } from 'react-i18next';
import { haptics } from '../lib/ui/haptics';
import { formatCountdown, formatWallClock } from '../lib/time/duration';

// ============================================================================
// TYPES
// ============================================================================

export interface FocusModeProps {
  visible: boolean;
  onClose: () => void;
  duration: number; // in seconds
  taskTitle: string;
  projectId?: string;
  taskId?: string;
  onSessionComplete: (data: FocusSessionResult) => void;
}

export interface FocusSessionResult {
  duration: number; // in seconds (actual time spent)
  pickupCount: number;
  completed: boolean;
  projectId?: string;
  taskId?: string;
}

// ============================================================================
// TUNING
// ============================================================================

// How the phone decides it has been picked up lives in lib/focus/pickupDetector, where the rule
// can be tested against a stream of samples. Ten readings a second is enough for a rule measured
// in seconds, and cheap enough to run for an hour.
const SENSOR_INTERVAL_MS = 100;
// A grace period after starting, resuming or turning the phone: settling it is not a pickup.
const PICKUP_ARM_DELAY_MS = 3_000;
const WARNING_VISIBLE_MS = 3_500;
// Below this, leaving is a change of mind rather than a session; recording it would only add
// noise to the history.
const MIN_RECORDED_SESSION_SEC = 60;
const CONTROLS_HIDE_MS = 4_000;
const TICK_MS = 250;

const noop = () => {};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ============================================================================
// PROGRESS RING
// ============================================================================

type ProgressRingProps = {
  size: number;
  progress: SharedValue<number>;
  children: React.ReactNode;
};

function ProgressRing({ size, progress, children }: ProgressRingProps) {
  const strokeWidth = Math.max(6, Math.round(size * 0.028));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="focusRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#8B5CF6" />
            <Stop offset="1" stopColor="#D946EF" />
          </SvgGradient>
        </Defs>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(139, 92, 246, 0.14)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#focusRing)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          // Start at twelve o'clock and fill clockwise.
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      {children}
    </View>
  );
}

// ============================================================================
// FOCUS MODE
// ============================================================================

/**
 * The timed focus session: one countdown, readable from across a desk, in either orientation.
 *
 * Time is kept against an absolute end timestamp rather than by counting interval ticks, so a
 * throttled JS thread or a pause can never make the clock drift.
 */
export const FocusMode: React.FC<FocusModeProps> = ({
  visible,
  onClose,
  duration,
  taskTitle,
  projectId,
  taskId,
  onSessionComplete,
}) => {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isLandscape = width > height;

  const [remaining, setRemaining] = useState(duration);
  const [isPaused, setIsPaused] = useState(false);
  const [clock, setClock] = useState(() => formatWallClock(new Date()));
  const [pickupCount, setPickupCount] = useState(0);
  const [isWarning, setIsWarning] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const endAtRef = useRef(0);
  const pausedRemainingMsRef = useRef(0);
  const finishedRef = useRef(false);
  const pickupsRef = useRef(0);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progress = useSharedValue(0);
  const controlsOpacity = useSharedValue(1);
  const warningOpacity = useSharedValue(0);

  // --------------------------------------------------------------------------
  // Controls: visible on open and while paused, otherwise fade out and wait for a tap.
  // --------------------------------------------------------------------------

  const scheduleHide = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      controlsOpacity.value = withTiming(0, { duration: 500 });
      setControlsVisible(false);
    }, CONTROLS_HIDE_MS);
  }, [controlsOpacity]);

  const revealControls = useCallback(() => {
    controlsOpacity.value = withTiming(1, { duration: 200 });
    setControlsVisible(true);
    scheduleHide();
  }, [controlsOpacity, scheduleHide]);

  // --------------------------------------------------------------------------
  // Session lifecycle
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!visible) return;

    finishedRef.current = false;
    pickupsRef.current = 0;
    endAtRef.current = Date.now() + duration * 1000;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a session starts from zero every time it opens
    setPickupCount(0);
    setIsPaused(false);
    setIsWarning(false);
    setRemaining(duration);
    setClock(formatWallClock(new Date()));

    cancelAnimation(progress);
    progress.value = 0;
    progress.value = withTiming(1, { duration: duration * 1000, easing: Easing.linear });
    warningOpacity.value = 0;
    revealControls();

    return () => {
      cancelAnimation(progress);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [visible, duration, progress, warningOpacity, revealControls]);

  // Returning from the background: the digits are already right, the ring is not.
  useEffect(() => {
    if (!visible || isPaused) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const leftMs = Math.max(0, endAtRef.current - Date.now());
      cancelAnimation(progress);
      progress.value = duration > 0 ? 1 - leftMs / (duration * 1000) : 1;
      if (leftMs > 0) {
        progress.value = withTiming(1, { duration: leftMs, easing: Easing.linear });
      }
    });
    return () => subscription.remove();
  }, [visible, isPaused, duration, progress]);

  // The countdown: derived from the end timestamp on every tick.
  useEffect(() => {
    if (!visible || isPaused) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      const nextClock = formatWallClock(new Date());
      setClock((current) => (current === nextClock ? current : nextClock));
    };
    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [visible, isPaused]);

  // Completion runs in an effect, never inside a state updater: reporting it updates the parent,
  // and doing that while React is still computing this component's state is exactly what used to
  // throw "Cannot update a component while rendering a different component".
  useEffect(() => {
    if (!visible || isPaused || remaining > 0 || finishedRef.current) return;
    // `remaining` can still hold the previous session's zero in the commit that reopens the
    // modal; the end timestamp is the authority on whether this session is really over.
    if (Date.now() < endAtRef.current) return;
    finishedRef.current = true;
    haptics.success();
    onSessionComplete({
      duration,
      pickupCount: pickupsRef.current,
      completed: true,
      projectId,
      taskId,
    });
  }, [visible, isPaused, remaining, duration, projectId, taskId, onSessionComplete]);

  const togglePause = useCallback(() => {
    haptics.tap();
    if (isPaused) {
      endAtRef.current = Date.now() + pausedRemainingMsRef.current;
      progress.value = withTiming(1, {
        duration: pausedRemainingMsRef.current,
        easing: Easing.linear,
      });
      setIsPaused(false);
      revealControls();
      return;
    }
    pausedRemainingMsRef.current = Math.max(0, endAtRef.current - Date.now());
    cancelAnimation(progress);
    progress.value = duration > 0 ? 1 - pausedRemainingMsRef.current / (duration * 1000) : 1;
    setIsPaused(true);
    // A paused session keeps its controls on screen: there is nothing to hide them for.
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsOpacity.value = withTiming(1, { duration: 200 });
    setControlsVisible(true);
  }, [isPaused, duration, progress, controlsOpacity, revealControls]);

  const handleClose = useCallback(() => {
    haptics.tap();
    const elapsed = Math.max(0, duration - remaining);
    if (!finishedRef.current && elapsed >= MIN_RECORDED_SESSION_SEC) {
      // Time spent is time spent. It is reported as unfinished, so nothing celebrates it.
      finishedRef.current = true;
      onSessionComplete({
        duration: elapsed,
        pickupCount: pickupsRef.current,
        completed: false,
        projectId,
        taskId,
      });
      return;
    }
    onClose();
  }, [onClose, onSessionComplete, duration, remaining, projectId, taskId]);

  // --------------------------------------------------------------------------
  // Pickup detection
  // --------------------------------------------------------------------------

  // Deliberately silent. The phone is already in the reader's hand when this fires, so the
  // message is seen without a buzz, and a vibration at that moment lands as a telling-off —
  // the opposite of what an app for people who struggle to start should do.
  const flashWarning = useCallback(() => {
    setIsWarning(true);
    warningOpacity.value = withTiming(1, { duration: 400 });
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    warningTimeoutRef.current = setTimeout(() => {
      warningOpacity.value = withTiming(0, { duration: 600 });
      setIsWarning(false);
    }, WARNING_VISIBLE_MS);
  }, [warningOpacity]);

  useEffect(() => {
    if (!visible || isPaused) return;
    const armedAt = Date.now() + PICKUP_ARM_DELAY_MS;
    const detector = createPickupDetector(Date.now());

    Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
    const subscription = Accelerometer.addListener((reading) => {
      const now = Date.now();
      // Samples before the grace period still feed the detector, so putting the phone down
      // during it drains the budget rather than leaving it primed to fire straight after.
      const pickedUp = detector.sample(magnitude(reading), now);
      if (!pickedUp || now < armedAt) return;
      pickupsRef.current += 1;
      setPickupCount(pickupsRef.current);
      flashWarning();
    });
    return () => subscription.remove();
  }, [visible, isPaused, flashWarning]);

  // --------------------------------------------------------------------------
  // Device state: orientation, immersive bars, keep-awake
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!visible) return;
    ScreenOrientation.unlockAsync().catch(noop);
    StatusBar.setHidden(true, 'fade');
    if (Platform.OS === 'android') {
      // Edge-to-edge apps may only toggle visibility; colour and position are the system's.
      NavigationBar.setVisibilityAsync('hidden').catch(noop);
    }
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(noop);
      StatusBar.setHidden(false, 'fade');
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible').catch(noop);
      }
    };
  }, [visible]);

  // This component stays mounted (hidden) inside every ProjectCard, so keep-awake is tied to
  // visibility; an activation with no resumed Activity would otherwise reject.
  useEffect(() => {
    if (!visible) return;
    const tag = `minito-focus-${Math.random().toString(36).slice(2, 9)}`;
    activateKeepAwakeAsync(tag).catch(noop);
    return () => {
      deactivateKeepAwake(tag).catch(noop);
    };
  }, [visible]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  const controlsStyle = useAnimatedStyle(() => ({ opacity: controlsOpacity.value }));
  const warningStyle = useAnimatedStyle(() => ({ opacity: warningOpacity.value }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: 1 - warningOpacity.value }));

  const countdown = formatCountdown(remaining);
  const ringSize = isLandscape
    ? Math.min(height - insets.top - insets.bottom - 48, width * 0.46)
    : Math.min(width * 0.8, height * 0.48, 420);
  // Long countdowns (1:04:05) need a smaller face to fit the ring.
  const digitSize = ringSize * (countdown.length > 5 ? 0.18 : 0.24);
  const controlsPointerEvents = controlsVisible ? 'auto' : 'none';

  const statusLine = (
    <View style={styles.statusLine}>
      <Animated.Text style={[styles.statusText, labelStyle]}>
        {isPaused ? t('focusMode.paused') : t('focusMode.focusLabel')}
      </Animated.Text>
      <Animated.Text
        style={[styles.statusText, styles.warningText, styles.overlayText, warningStyle]}
        accessibilityLiveRegion="polite"
      >
        {isWarning ? t('focusMode.gentleWarning') : ''}
      </Animated.Text>
    </View>
  );

  const ring = (
    <ProgressRing size={ringSize} progress={progress}>
      <Text
        style={[styles.countdown, { fontSize: digitSize }, isPaused && styles.countdownPaused]}
        accessibilityRole="timer"
        accessibilityLabel={t('focusMode.remainingA11y', { time: countdown })}
      >
        {countdown}
      </Text>
      <Text style={[styles.clock, { fontSize: Math.max(13, ringSize * 0.05) }]}>{clock}</Text>
    </ProgressRing>
  );

  const pauseButton = (
    <TouchableOpacity
      onPress={togglePause}
      activeOpacity={0.8}
      style={[styles.pauseButton, isPaused && styles.pauseButtonActive]}
      accessibilityRole="button"
      accessibilityLabel={isPaused ? t('focusMode.resume') : t('focusMode.pause')}
    >
      {isPaused ? (
        <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
      ) : (
        <Pause size={20} color="rgba(255,255,255,0.75)" />
      )}
      <Text style={[styles.pauseText, !isPaused && styles.pauseTextMuted]}>
        {isPaused ? t('focusMode.resume') : t('focusMode.pause')}
      </Text>
    </TouchableOpacity>
  );

  const closeButton = (
    <TouchableOpacity
      onPress={handleClose}
      style={styles.iconButton}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={t('focusMode.end')}
    >
      <X size={22} color="rgba(255,255,255,0.6)" />
    </TouchableOpacity>
  );

  const pickups =
    pickupCount > 0 ? (
      <View
        style={styles.pickups}
        accessibilityLabel={t('focusMode.pickupsA11y', { count: pickupCount })}
      >
        <Smartphone size={13} color="rgba(255,255,255,0.35)" />
        <Text style={styles.pickupsText}>{pickupCount}</Text>
      </View>
    ) : null;

  const edges = {
    paddingTop: insets.top + 12,
    paddingBottom: insets.bottom + 12,
    paddingLeft: insets.left + 20,
    paddingRight: insets.right + 20,
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleClose}
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
    >
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={styles.root}
      >
        <LinearGradient
          colors={['#05050A', '#140A26', '#07070D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <Pressable style={[styles.fill, edges]} onPress={revealControls}>
          {isLandscape ? (
            <View style={styles.landscape}>
              <View style={styles.landscapeRing}>{ring}</View>
              <View style={styles.landscapeSide}>
                <Animated.View
                  style={[styles.landscapeTop, controlsStyle]}
                  pointerEvents={controlsPointerEvents}
                >
                  <Text style={styles.title} numberOfLines={2}>
                    {taskTitle}
                  </Text>
                  {closeButton}
                </Animated.View>
                {statusLine}
                <Animated.View style={controlsStyle} pointerEvents={controlsPointerEvents}>
                  {pauseButton}
                </Animated.View>
                {pickups}
              </View>
            </View>
          ) : (
            <View style={styles.portrait}>
              <Animated.View
                style={[styles.portraitTop, controlsStyle]}
                pointerEvents={controlsPointerEvents}
              >
                {closeButton}
                <Text style={[styles.title, styles.portraitTitle]} numberOfLines={1}>
                  {taskTitle}
                </Text>
                <View style={styles.iconButton} />
              </Animated.View>

              <View style={styles.portraitCenter}>
                {ring}
                {statusLine}
              </View>

              <Animated.View
                style={[styles.portraitBottom, controlsStyle]}
                pointerEvents={controlsPointerEvents}
              >
                {pauseButton}
              </Animated.View>
              {pickups}
            </View>
          )}
        </Pressable>
      </Animated.View>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fill: {
    flex: 1,
  },
  portrait: {
    flex: 1,
  },
  portraitTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  portraitTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  portraitCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  portraitBottom: {
    alignItems: 'center',
    paddingBottom: 28,
  },
  landscape: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  landscapeRing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landscapeSide: {
    flex: 0.8,
    height: '100%',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingLeft: 24,
  },
  landscapeTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.55)',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  countdown: {
    color: '#FFFFFF',
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    textShadowColor: 'rgba(139, 92, 246, 0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  countdownPaused: {
    opacity: 0.45,
  },
  clock: {
    marginTop: 4,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  statusLine: {
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
  },
  overlayText: {
    position: 'absolute',
  },
  warningText: {
    color: '#FCA5A5',
    letterSpacing: 1.5,
  },
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pauseButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#34D399',
  },
  pauseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pauseTextMuted: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  pickups: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
  },
  pickupsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.35)',
    fontVariant: ['tabular-nums'],
  },
});

export default FocusMode;
