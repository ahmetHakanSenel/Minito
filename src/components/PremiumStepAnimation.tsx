import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/**
 * The moment a step is done: a seal that draws itself, a small burst of sparks, and a line saying
 * how far along the person is. About a second, then the next step.
 *
 * It is short on purpose. The reward is the acknowledgement, not the wait; anything longer starts
 * to stand between someone with momentum and their next action.
 *
 * Everything runs off one clock (0 → 1), and each element maps its own slice of that clock, so
 * the choreography is deterministic and has no springs to overshoot.
 */

export const STEP_CELEBRATION_MS = 1050;

// Keyframes, in milliseconds on the shared clock.
const at = (ms: number) => ms / STEP_CELEBRATION_MS;
const SCRIM_IN = [0, at(120)];
const DISC_IN = [at(40), at(300)];
const RING_DRAW = [at(60), at(400)];
const CHECK_DRAW = [at(230), at(480)];
const SPARKS = [at(250), at(760)];
const LABEL_IN = [at(300), at(480)];
const GLOW_FADE = [at(400), at(840)];
const EXIT = [at(840), 1];

const SEAL = 132;
const CENTER = SEAL / 2;
const RING_R = 61;
const RING_LENGTH = 2 * Math.PI * RING_R;
const CHECK_PATH = 'M47 67 L60 80 L86 53';
const CHECK_LENGTH = 58;

const SPARK_COLORS = ['#6EE7B7', '#A78BFA', '#F0ABFC', '#34D399'];
const SPARK_COUNT = 10;
const SPARK_REACH = 58;

const easeOutBack = Easing.out(Easing.back(1.6));
const easeOutCubic = Easing.out(Easing.cubic);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

function slice(clock: number, [from, to]: number[]): number {
  'worklet';
  return interpolate(clock, [from, to], [0, 1], Extrapolation.CLAMP);
}

interface PremiumStepAnimationProps {
  visible: boolean;
  onComplete?: () => void;
  /** Steps done so far, including this one, and the total: shown under the seal. */
  completedCount?: number;
  totalSteps?: number;
}

function Spark({ index, clock }: { index: number; clock: SharedValue<number> }) {
  // Evenly spread, with every other spark a little further and smaller, so the burst has depth.
  const angle = (index / SPARK_COUNT) * Math.PI * 2 - Math.PI / 2;
  const reach = SPARK_REACH * (index % 2 === 0 ? 1 : 0.78);
  const size = index % 2 === 0 ? 9 : 6;

  const style = useAnimatedStyle(() => {
    const p = easeOutCubic(slice(clock.value, SPARKS));
    return {
      opacity: p === 0 ? 0 : interpolate(p, [0, 0.25, 1], [0, 1, 0]),
      transform: [
        { translateX: Math.cos(angle) * (RING_R - 6 + reach * p) },
        { translateY: Math.sin(angle) * (RING_R - 6 + reach * p) },
        { scale: interpolate(p, [0, 1], [1, 0.4]) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.spark,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: SPARK_COLORS[index % SPARK_COLORS.length],
        },
        style,
      ]}
    />
  );
}

export const PremiumStepAnimation: React.FC<PremiumStepAnimationProps> = ({
  visible,
  onComplete,
  completedCount,
  totalSteps,
}) => {
  const { t } = useTranslation();
  const clock = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(clock);
    clock.value = 0;
    if (!visible) return;
    clock.value = withTiming(
      1,
      { duration: STEP_CELEBRATION_MS, easing: Easing.linear },
      (done) => {
        if (done && onComplete) runOnJS(onComplete)();
      }
    );
    return () => cancelAnimation(clock);
    // onComplete is read when the clock finishes; restarting on its identity would replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, clock]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: slice(clock.value, SCRIM_IN) * (1 - slice(clock.value, EXIT)),
  }));

  const groupStyle = useAnimatedStyle(() => {
    const exit = easeOutCubic(slice(clock.value, EXIT));
    return {
      opacity: 1 - exit,
      transform: [{ scale: 1 - exit * 0.06 }, { translateY: -exit * 8 }],
    };
  });

  const discStyle = useAnimatedStyle(() => {
    const p = slice(clock.value, DISC_IN);
    return {
      opacity: p === 0 ? 0 : 1,
      transform: [{ scale: interpolate(easeOutBack(p), [0, 1], [0.55, 1]) }],
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    const p = slice(clock.value, DISC_IN);
    const fade = slice(clock.value, GLOW_FADE);
    return {
      opacity: p * (0.55 - fade * 0.35),
      transform: [{ scale: 0.8 + easeOutCubic(p) * 0.45 }],
    };
  });

  const ringProps = useAnimatedProps(() => {
    const p = slice(clock.value, RING_DRAW);
    return {
      strokeDashoffset: RING_LENGTH * (1 - easeOutCubic(p)),
      // A zero-length dash with round caps can still paint a dot; keep it hidden until it draws.
      strokeOpacity: p === 0 ? 0 : 0.85,
    };
  });

  const checkProps = useAnimatedProps(() => {
    const p = slice(clock.value, CHECK_DRAW);
    return {
      strokeDashoffset: CHECK_LENGTH * (1 - easeOutCubic(p)),
      strokeOpacity: p === 0 ? 0 : 1,
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const p = easeOutCubic(slice(clock.value, LABEL_IN));
    return { opacity: p, transform: [{ translateY: (1 - p) * 8 }] };
  });

  if (!visible) return null;

  const hasProgress = completedCount !== undefined && totalSteps !== undefined;

  return (
    <View style={styles.container} pointerEvents="auto">
      <Animated.View style={[styles.scrim, scrimStyle]} />

      <Animated.View style={[styles.group, groupStyle]}>
        <View style={styles.seal}>
          <Animated.View style={[styles.glow, glowStyle]} />

          {Array.from({ length: SPARK_COUNT }, (_, index) => (
            <Spark key={index} index={index} clock={clock} />
          ))}

          <Animated.View style={[StyleSheet.absoluteFill, discStyle]}>
            <Svg width={SEAL} height={SEAL}>
              <Defs>
                <LinearGradient id="stepSealFill" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#34D399" />
                  <Stop offset="1" stopColor="#059669" />
                </LinearGradient>
              </Defs>
              <Circle cx={CENTER} cy={CENTER} r={48} fill="url(#stepSealFill)" />
              <Circle
                cx={CENTER}
                cy={CENTER}
                r={42}
                fill="none"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth={1}
              />
              <AnimatedPath
                d={CHECK_PATH}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={`${CHECK_LENGTH} ${CHECK_LENGTH}`}
                animatedProps={checkProps}
              />
            </Svg>
          </Animated.View>

          <Svg width={SEAL} height={SEAL} style={StyleSheet.absoluteFill}>
            <AnimatedCircle
              cx={CENTER}
              cy={CENTER}
              r={RING_R}
              fill="none"
              stroke="#6EE7B7"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={`${RING_LENGTH} ${RING_LENGTH}`}
              animatedProps={ringProps}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
          </Svg>
        </View>

        {hasProgress ? (
          <Animated.View style={labelStyle}>
            <Text style={styles.label}>
              {t('focus.stepDone', { done: completedCount, total: totalSteps })}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 5, 16, 0.62)',
  },
  group: {
    alignItems: 'center',
    gap: 18,
  },
  seal: {
    width: SEAL,
    height: SEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: SEAL,
    height: SEAL,
    borderRadius: SEAL / 2,
    backgroundColor: 'rgba(52, 211, 153, 0.35)',
  },
  spark: {
    position: 'absolute',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
