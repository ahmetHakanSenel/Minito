import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { haptics } from '../../lib/ui/haptics';
import { flingTarget, nearestDetent, stripTranslate, wrap } from './dialMath';

/**
 * A detent dial, closer to setting a watch than to scrolling a list.
 *
 * Every value is a detent. The dial follows the finger and clicks (a capped haptic tick) as values
 * cross the window. On release it keeps the speed it was let go with and glides into a detent on a
 * critically damped spring: no jump in pace, no bounce, and never back against the direction of a
 * throw. A slow release simply falls into the nearest value. No 3D tilt, so nothing wobbles.
 *
 * It is not a list. A short strip of labels covering one lap, plus a margin either side, is
 * translated on the UI thread, and the position wraps modulo the lap, so the dial turns forever
 * without re-rendering a single label. That also keeps it legal inside a vertical ScrollView,
 * where a virtualized list is not.
 */

const ROW_HEIGHT = 40;
const VISIBLE_ROWS = 5;
const WINDOW_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const CENTER_OFFSET = (WINDOW_HEIGHT - ROW_HEIGHT) / 2;
// Rows beyond the window on either side, so a partly visible row always has a label to draw.
const MARGIN_ROWS = Math.ceil(VISIBLE_ROWS / 2) + 1;
// Ticks are capped at about eleven a second. A slow turn clicks on every value; a fast spin clicks
// at a steady rate instead of blurring into a buzz, and the values between pass silently.
const TICK_MIN_INTERVAL_MS = 90;
// Critically damped (damping = 2·√stiffness): the dial glides into a detent with no bounce.
// Clamping ends the glide at the detent itself, which is what a click-stop feels like.
const SETTLE_SPRING = { stiffness: 170, damping: 26, mass: 1, overshootClamping: true };
// A preset turns the dial from rest, so it eases in and out like a hand turning it.
const PRESET_TURN = { minMs: 220, maxMs: 460, msPerRow: 8 };

const WELL_COLOR = '#12121C';
const WELL_COLOR_CLEAR = 'rgba(18, 18, 28, 0)';

export const WHEEL_HEIGHT = WINDOW_HEIGHT;

type WheelPickerProps = {
  /** Number of distinct values; the dial shows 0 … count − 1 and wraps. */
  count: number;
  value: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  width?: number;
  accessibilityLabel?: string;
};

const pad2 = (value: number) => value.toString().padStart(2, '0');

type StripProps = {
  labels: string[];
  /** Absolute index of the first label; the middle lap starts at index `count`. */
  firstIndex: number;
  count: number;
  position: SharedValue<number>;
  /** Where, inside its container, the selected row's top edge sits. */
  offset: number;
  textStyle: TextStyle;
};

// One strip of labels, moved as a whole: its translateY is the only thing that animates.
const Strip = memo(function Strip({
  labels,
  firstIndex,
  count,
  position,
  offset,
  textStyle,
}: StripProps) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: stripTranslate(position.value, count, firstIndex, offset, ROW_HEIGHT) },
    ],
  }));

  return (
    <Animated.View style={style}>
      {labels.map((label, i) => (
        <View key={i} style={styles.row}>
          <Text style={textStyle}>{label}</Text>
        </View>
      ))}
    </Animated.View>
  );
});

export function WheelPicker({
  count,
  value,
  onChange,
  formatValue = pad2,
  width = 76,
  accessibilityLabel,
}: WheelPickerProps) {
  const position = useSharedValue(value);
  const dragStart = useSharedValue(0);
  // The value last reported to the parent, so its echo never turns the dial back.
  const reportedRef = useRef(value);
  // Set while the dial turns itself to a value the parent chose (a preset). The values it passes
  // on the way still click, but are not reported: two dials doing that at once would each
  // overwrite the other's half of the duration and pull each other back.
  const externalTargetRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);

  const labels = useMemo(() => {
    const labelAt = (index: number) => formatValue(wrap(index, count));
    const range = (from: number, to: number) =>
      Array.from({ length: to - from }, (_, i) => labelAt(from + i));
    // The visible value always lies in the middle lap, [count, 2·count). The dim strip needs the
    // rows around it that can show in the window; the lens only ever shows one row and its
    // neighbours while they slide through.
    const dimFirst = count - MARGIN_ROWS;
    const lensFirst = count - 1;
    return {
      dim: range(dimFirst, 2 * count + MARGIN_ROWS),
      dimFirst,
      lens: range(lensFirst, 2 * count + 1),
      lensFirst,
    };
  }, [count, formatValue]);

  const tick = useCallback(() => {
    const now = Date.now();
    if (now - lastTickRef.current < TICK_MIN_INTERVAL_MS) return;
    lastTickRef.current = now;
    haptics.tick();
  }, []);

  const report = useCallback(
    (index: number) => {
      const next = wrap(index, count);
      if (externalTargetRef.current !== null) {
        // Turning itself to a preset: silent on the way, one click as it lands. Ten minutes to
        // sixty is fifty values; felt one by one, that is a buzz, not a click.
        if (next === externalTargetRef.current) {
          externalTargetRef.current = null;
          tick();
        }
        return;
      }
      tick();
      if (next === reportedRef.current) return;
      reportedRef.current = next;
      onChange(next);
    },
    [count, onChange, tick]
  );

  // Any direct handling of the dial makes it the user's again.
  const releaseExternal = useCallback(() => {
    externalTargetRef.current = null;
  }, []);

  // The click: fires as each value crosses the centre of the window, while the dial moves.
  useAnimatedReaction(
    () => Math.round(position.value),
    (current, previous) => {
      if (previous !== null && current !== previous) {
        runOnJS(report)(current);
      }
    },
    [report]
  );

  // The dial keeps the speed it was released with and glides from there into the detent, so there
  // is no jump in pace at the moment the finger lifts.
  const glideTo = useCallback(
    (target: number, velocityRowsPerS: number) => {
      'worklet';
      position.value = withSpring(target, { ...SETTLE_SPRING, velocity: velocityRowsPerS });
    },
    [position]
  );

  const turnTo = useCallback(
    (target: number) => {
      'worklet';
      const rows = Math.abs(target - position.value);
      position.value = withTiming(target, {
        duration: Math.min(
          PRESET_TURN.maxMs,
          Math.max(PRESET_TURN.minMs, rows * PRESET_TURN.msPerRow)
        ),
        easing: Easing.inOut(Easing.cubic),
      });
    },
    [position]
  );

  // A value set from outside (a preset) turns the dial the short way round to it.
  useEffect(() => {
    if (value === reportedRef.current) return;
    reportedRef.current = value;
    cancelAnimation(position);
    const target = nearestDetent(position.value, value, count);
    // Only a dial that will actually move holds back its reports and ticks until it lands.
    externalTargetRef.current = target === Math.round(position.value) ? null : value;
    turnTo(target);
  }, [value, count, position, turnTo]);

  const step = useCallback(
    (direction: 1 | -1) => {
      releaseExternal();
      cancelAnimation(position);
      glideTo(Math.round(position.value) + direction, 0);
    },
    [position, glideTo, releaseExternal]
  );

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetY([-4, 4])
      .failOffsetX([-14, 14])
      .onBegin(() => {
        cancelAnimation(position);
        runOnJS(releaseExternal)();
      })
      .onStart(() => {
        dragStart.value = position.value;
      })
      .onUpdate((event) => {
        // Dragging up brings the next values into the window, as on a physical dial.
        position.value = dragStart.value - event.translationY / ROW_HEIGHT;
      })
      .onEnd((event) => {
        // Dragging up is a positive turn, so the finger's velocity is inverted.
        const velocity = -event.velocityY / ROW_HEIGHT;
        glideTo(flingTarget(position.value, velocity), velocity);
      })
      .onFinalize((_event, success) => {
        // A touch that never became a drag must still leave the dial resting on a detent.
        if (!success) glideTo(Math.round(position.value), 0);
      });

    // A tap above or below the window steps once, for anyone who would rather not drag.
    const tap = Gesture.Tap()
      .maxDuration(250)
      .onEnd((event, success) => {
        if (!success) return;
        const rows = (event.y - CENTER_OFFSET - ROW_HEIGHT / 2) / ROW_HEIGHT;
        if (Math.abs(rows) < 0.5) return;
        runOnJS(step)(rows > 0 ? 1 : -1);
      });

    return Gesture.Race(pan, tap);
  }, [dragStart, position, glideTo, step, releaseExternal]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.well, { width }]}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: formatValue(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          step(event.nativeEvent.actionName === 'increment' ? 1 : -1)
        }
      >
        <Strip
          labels={labels.dim}
          firstIndex={labels.dimFirst}
          count={count}
          position={position}
          offset={CENTER_OFFSET}
          textStyle={styles.dimText}
        />

        {/* The dial fades into the well above and below the window. */}
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

        {/* The lens: the same dial, larger and brighter, seen through the centre window. */}
        <View pointerEvents="none" style={styles.lens}>
          <Strip
            labels={labels.lens}
            firstIndex={labels.lensFirst}
            count={count}
            position={position}
            offset={0}
            textStyle={styles.lensText}
          />
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  well: {
    height: WINDOW_HEIGHT,
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: WELL_COLOR,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  row: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimText: {
    fontSize: 20,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.38)',
    fontVariant: ['tabular-nums'],
  },
  lens: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: CENTER_OFFSET,
    height: ROW_HEIGHT,
    overflow: 'hidden',
    backgroundColor: '#1D1B30',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  lensText: {
    fontSize: 27,
    fontWeight: '600',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_HEIGHT * 1.6,
  },
  fadeTop: {
    top: 0,
  },
  fadeBottom: {
    bottom: 0,
  },
});
