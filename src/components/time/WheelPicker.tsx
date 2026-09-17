import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView as RNScrollView,
} from 'react-native';
// The gesture-aware ScrollView, so a drag on the wheel wins over the sheet it sits in.
import { ScrollView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { haptics } from '../../lib/ui/haptics';
import { clamp, indexFromOffset, offsetForIndex, rowAppearance } from './wheelMath';

/**
 * A value wheel, built on the platform's own scrolling.
 *
 * This is the behaviour people already have in their fingers from every picker on their phone:
 * drag and it follows; flick and it carries on with the system's own deceleration; release
 * anywhere and it settles on the nearest value. Rows fade and shrink with distance from the
 * window, which is what makes a flat list read as a wheel, and each value that reaches the
 * window gives one light click.
 *
 * Deliberately not clever. An earlier version modelled the momentum itself — a spring settle, a
 * hand-rolled fling target, an endless strip translated on the UI thread. It was tuned to feel
 * right on one device, and every platform gesture it reimplemented was one more thing to get
 * subtly wrong. Handing the physics back to the scroll view costs nothing visually and means the
 * wheel ages with the OS instead of against it.
 */

const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const WINDOW_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const PADDING = (WINDOW_HEIGHT - ROW_HEIGHT) / 2;
// A fast flick crosses rows quicker than the motor can click. The cap keeps the ticks distinct:
// see the note in lib/ui/haptics on why Android's pulse needs this much room.
const TICK_MIN_INTERVAL_MS = 90;
// A value set from outside scrolls the wheel; that travel is the app's doing, so it stays silent.
const PROGRAMMATIC_QUIET_MS = 450;

const WELL_COLOR = '#12121C';
const WELL_COLOR_CLEAR = 'rgba(18, 18, 28, 0)';

export const WHEEL_HEIGHT = WINDOW_HEIGHT;

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

type WheelPickerProps = {
  /** Number of values; the wheel shows 0 … count − 1. */
  count: number;
  value: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  width?: number;
  accessibilityLabel?: string;
};

const pad2 = (value: number) => value.toString().padStart(2, '0');

type RowProps = { label: string; index: number; offset: SharedValue<number> };

const Row = memo(function Row({ label, index, offset }: RowProps) {
  const style = useAnimatedStyle(() => {
    const { opacity, scale } = rowAppearance(index - offset.value / ROW_HEIGHT);
    return { opacity, transform: [{ scale }] };
  });

  return (
    <Animated.View style={[styles.row, style]}>
      <Text style={styles.rowText}>{label}</Text>
    </Animated.View>
  );
});

export function WheelPicker({
  count,
  value,
  onChange,
  formatValue = pad2,
  width = 84,
  accessibilityLabel,
}: WheelPickerProps) {
  const scrollRef = useRef<RNScrollView>(null);
  const offset = useSharedValue(offsetForIndex(value, ROW_HEIGHT));
  // What the parent last heard. Its echo of that value must not fight the finger.
  const reportedRef = useRef(value);
  const lastTickRef = useRef(0);
  const quietUntilRef = useRef(0);
  // While a finger or its momentum owns the wheel, an incoming value never moves it.
  const interactingRef = useRef(false);

  const labels = useMemo(
    () => Array.from({ length: count }, (_, index) => formatValue(index)),
    [count, formatValue]
  );

  const tick = useCallback(() => {
    const now = Date.now();
    if (now < quietUntilRef.current) return;
    if (now - lastTickRef.current < TICK_MIN_INTERVAL_MS) return;
    lastTickRef.current = now;
    haptics.tick();
  }, []);

  const commit = useCallback(
    (index: number) => {
      const next = clamp(index, 0, count - 1);
      if (next === reportedRef.current) return;
      reportedRef.current = next;
      onChange(next);
    },
    [count, onChange]
  );

  const scrollTo = useCallback((index: number, animated: boolean) => {
    if (animated) quietUntilRef.current = Date.now() + PROGRAMMATIC_QUIET_MS;
    scrollRef.current?.scrollTo({ y: offsetForIndex(index, ROW_HEIGHT), animated });
  }, []);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      offset.value = event.contentOffset.y;
    },
  });

  // One click per value that reaches the window, whether the finger or its momentum brought it.
  useAnimatedReaction(
    () => Math.round(offset.value / ROW_HEIGHT),
    (current, previous) => {
      if (previous !== null && current !== previous) runOnJS(tick)();
    },
    [tick]
  );

  const settle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      interactingRef.current = false;
      commit(indexFromOffset(event.nativeEvent.contentOffset.y, ROW_HEIGHT, count));
    },
    [commit, count]
  );

  // A value chosen elsewhere — a preset, a reset, the timer counting down — turns the wheel,
  // unless a finger is on it.
  useEffect(() => {
    if (value === reportedRef.current || interactingRef.current) return;
    reportedRef.current = value;
    scrollTo(clamp(value, 0, count - 1), true);
  }, [value, count, scrollTo]);

  const step = useCallback(
    (direction: 1 | -1) => {
      const next = clamp(reportedRef.current + direction, 0, count - 1);
      commit(next);
      scrollTo(next, true);
    },
    [commit, count, scrollTo]
  );

  return (
    <View
      style={[styles.well, { width }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: count - 1, now: value, text: formatValue(value) }}
      accessibilityActions={ADJUST_ACTIONS}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      {/* The window: one row, ruled top and bottom, the way a picker always shows its value. */}
      <View pointerEvents="none" style={styles.window} />

      <AnimatedScrollView
        ref={scrollRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        // The wheel takes the drag first; the sheet behind it scrolls once the wheel is at an end.
        nestedScrollEnabled
        // The platform's own deceleration, brought to rest on a value.
        decelerationRate="fast"
        snapToInterval={ROW_HEIGHT}
        snapToAlignment="start"
        contentOffset={{ x: 0, y: offsetForIndex(value, ROW_HEIGHT) }}
        contentContainerStyle={styles.content}
        onScrollBeginDrag={() => {
          interactingRef.current = true;
        }}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
      >
        {labels.map((label, index) => (
          <Row key={label} label={label} index={index} offset={offset} />
        ))}
      </AnimatedScrollView>

      {/* The rows fade into the well at both ends rather than being cut off by it. */}
      <LinearGradient
        pointerEvents="none"
        colors={[WELL_COLOR, WELL_COLOR_CLEAR]}
        style={[styles.fade, styles.fadeTop]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[WELL_COLOR_CLEAR, WELL_COLOR]}
        style={[styles.fade, styles.fadeBottom]}
      />
    </View>
  );
}

const ADJUST_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }];

const styles = StyleSheet.create({
  well: {
    height: WINDOW_HEIGHT,
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: WELL_COLOR,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  content: {
    paddingVertical: PADDING,
  },
  row: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    fontSize: 26,
    fontWeight: '600',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  window: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: PADDING,
    height: ROW_HEIGHT,
    backgroundColor: 'rgba(139, 92, 246, 0.10)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_HEIGHT * 1.4,
  },
  fadeTop: {
    top: 0,
  },
  fadeBottom: {
    bottom: 0,
  },
});
