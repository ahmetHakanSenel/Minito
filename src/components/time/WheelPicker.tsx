import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type FlatList, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { haptics } from '../../lib/ui/haptics';

/**
 * An endlessly looping wheel, like a physical combination lock: 59 is always one flick away from
 * 00, in both directions.
 *
 * The loop is an illusion built from a long list of repeated cycles, started in the middle and
 * quietly re-centred whenever it settles near either end. Nobody flicks through a hundred cycles,
 * so the seam is never reached.
 */

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PADDING = (ITEM_HEIGHT * (VISIBLE_ITEMS - 1)) / 2;
// Enough rows that even a short cycle (0–4 hours) has room to spin.
const MIN_TOTAL_ROWS = 3000;
// Re-centre once a settle lands this many cycles from either end.
const EDGE_CYCLES = 10;

type WheelPickerProps = {
  /** Number of distinct values; the wheel shows 0 … count − 1. */
  count: number;
  value: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  width?: number;
  accessibilityLabel?: string;
};

type WheelRowProps = {
  index: number;
  label: string;
  scrollY: SharedValue<number>;
};

// Each row reads the shared scroll position on the UI thread, so the 3D tilt costs no renders.
const WheelRow = memo(function WheelRow({ index, label, scrollY }: WheelRowProps) {
  const style = useAnimatedStyle(() => {
    const distance = (index * ITEM_HEIGHT - scrollY.value) / ITEM_HEIGHT;
    const reach = Math.min(Math.abs(distance), 3);
    return {
      opacity: interpolate(reach, [0, 1, 2, 3], [1, 0.45, 0.18, 0.05]),
      transform: [
        { perspective: 500 },
        {
          rotateX: `${interpolate(distance, [-3, 0, 3], [62, 0, -62], Extrapolation.CLAMP)}deg`,
        },
        { scale: interpolate(reach, [0, 2], [1, 0.86], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.row, style]}>
      <Text style={styles.rowText}>{label}</Text>
    </Animated.View>
  );
});

const pad2 = (value: number) => value.toString().padStart(2, '0');

export function WheelPicker({
  count,
  value,
  onChange,
  formatValue = pad2,
  width = 72,
  accessibilityLabel,
}: WheelPickerProps) {
  const cycles = Math.max(100, Math.ceil(MIN_TOTAL_ROWS / count));
  const middleCycle = Math.floor(cycles / 2);
  const rows = useMemo(
    () => Array.from({ length: cycles * count }, (_, index) => index),
    [cycles, count]
  );

  const listRef = useRef<FlatList<number>>(null);
  const scrollY = useSharedValue((middleCycle * count + value) * ITEM_HEIGHT);
  // The last value this wheel reported, so an echo from the parent never scrolls it back.
  const reportedRef = useRef(value);
  const [ready, setReady] = useState(false);

  const indexForValue = useCallback(
    (target: number, near: number) => {
      const cycle = Math.floor(near / count);
      // Of the three candidates around the current cycle, take the closest: the wheel turns the
      // short way, never through a full revolution.
      const candidates = [cycle - 1, cycle, cycle + 1].map((c) => c * count + target);
      return candidates.reduce((best, candidate) =>
        Math.abs(candidate - near) < Math.abs(best - near) ? candidate : best
      );
    },
    [count]
  );

  const scrollToIndex = useCallback((index: number, animated: boolean) => {
    listRef.current?.scrollToOffset({ offset: index * ITEM_HEIGHT, animated });
  }, []);

  const handleLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      if (ready) return;
      scrollToIndex(middleCycle * count + value, false);
      setReady(true);
    },
    [ready, scrollToIndex, middleCycle, count, value]
  );

  // A value set from outside (a preset chip) turns the wheel to it.
  useEffect(() => {
    if (!ready || value === reportedRef.current) return;
    reportedRef.current = value;
    const current = Math.round(scrollY.value / ITEM_HEIGHT);
    scrollToIndex(indexForValue(value, current), true);
  }, [value, ready, indexForValue, scrollToIndex, scrollY]);

  const report = useCallback(
    (index: number) => {
      const next = ((index % count) + count) % count;
      if (next === reportedRef.current) return;
      reportedRef.current = next;
      haptics.selection();
      onChange(next);
    },
    [count, onChange]
  );

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // The value changes as each row crosses the centre, not only when the wheel stops: the tick
  // under the finger is what makes it feel like a physical dial.
  useAnimatedReaction(
    () => Math.round(scrollY.value / ITEM_HEIGHT),
    (index, previous) => {
      if (previous !== null && index !== previous) {
        runOnJS(report)(index);
      }
    },
    [report]
  );

  const handleSettle = useCallback(
    (offsetY: number) => {
      const index = Math.round(offsetY / ITEM_HEIGHT);
      report(index);
      const cycle = Math.floor(index / count);
      if (cycle < EDGE_CYCLES || cycle > cycles - EDGE_CYCLES) {
        // Same value, middle of the list: invisible to the user, endless in practice.
        scrollToIndex(middleCycle * count + (((index % count) + count) % count), false);
      }
    },
    [report, count, cycles, middleCycle, scrollToIndex]
  );

  const renderItem = useCallback(
    ({ item }: { item: number }) => (
      <WheelRow index={item} label={formatValue(item % count)} scrollY={scrollY} />
    ),
    [formatValue, count, scrollY]
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<number> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT,
      offset: PADDING + ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  return (
    <View
      style={[styles.frame, { width }]}
      onLayout={handleLayout}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: formatValue(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const step = event.nativeEvent.actionName === 'increment' ? 1 : -1;
        const next = (value + step + count) % count;
        reportedRef.current = next;
        onChange(next);
        scrollToIndex(indexForValue(next, Math.round(scrollY.value / ITEM_HEIGHT)), true);
      }}
    >
      <View pointerEvents="none" style={styles.selectionBand} />
      <Animated.FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(item) => String(item)}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: PADDING }}
        onMomentumScrollEnd={(event) => handleSettle(event.nativeEvent.contentOffset.y)}
        initialNumToRender={VISIBLE_ITEMS * 2}
        windowSize={5}
        maxToRenderPerBatch={VISIBLE_ITEMS * 2}
        style={{ opacity: ready ? 1 : 0 }}
        nestedScrollEnabled
      />
    </View>
  );
}

export const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const styles = StyleSheet.create({
  frame: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    overflow: 'hidden',
  },
  selectionBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: PADDING,
    height: ITEM_HEIGHT,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  row: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    fontSize: 26,
    fontWeight: '600',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
});
