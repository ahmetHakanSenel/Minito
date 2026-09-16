import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const STAGES = ['analyzing', 'generating', 'finalizing'] as const;
// When each later stage lights up. The last one holds until the response actually arrives,
// so the UI never claims to be done before the server is.
const STAGE_DELAYS_MS = [1200, 3200];
const SKELETON_WIDTHS: DimensionValue[] = ['92%', '76%', '84%'];

function ShimmerBar({ width }: { width: DimensionValue }) {
  const [barWidth, setBarWidth] = useState(0);
  const progress = useSharedValue(-1);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [progress]);

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * barWidth }],
  }));

  return (
    <View
      style={[styles.bar, { width }]}
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View style={[StyleSheet.absoluteFill, highlightStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255, 255, 255, 0.12)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function ActiveDot() {
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [pulse]);

  const style = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.8 + pulse.value * 0.3 }],
  }));

  return <Animated.View style={[styles.activeDot, style]} />;
}

export function BreakdownProgress() {
  const { t } = useTranslation();
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const timers = STAGE_DELAYS_MS.map((delay, index) =>
      setTimeout(() => setActiveStage(index + 1), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      style={styles.container}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.title}>{t('tasks.progress.title')}</Text>

      {STAGES.map((stage, index) => {
        const isDone = index < activeStage;
        const isActive = index === activeStage;
        return (
          <View key={stage} style={styles.stageRow}>
            <View style={styles.stageIcon}>
              {isDone ? (
                <Check size={14} color="#34D399" strokeWidth={3} />
              ) : isActive ? (
                <ActiveDot />
              ) : (
                <View style={styles.pendingDot} />
              )}
            </View>
            <Text
              style={[
                styles.stageText,
                isActive && styles.stageTextActive,
                !isDone && !isActive && styles.stageTextPending,
              ]}
            >
              {t(`tasks.progress.${stage}`)}
            </Text>
          </View>
        );
      })}

      <View style={styles.skeleton}>
        {SKELETON_WIDTHS.map((width, index) => (
          <ShimmerBar key={index} width={width} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 28,
  },
  title: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  stageIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8B5CF6',
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  stageText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  stageTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  stageTextPending: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  skeleton: {
    marginTop: 10,
    gap: 10,
  },
  bar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
});
