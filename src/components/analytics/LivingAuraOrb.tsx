import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Paint,
  Blur,
  ColorMatrix,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  useFrameCallback,
  withTiming,
  interpolateColor,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LIVING AURA ORB
//
// A single-cell organism made of three metaballs. The gooey merge is
// produced the correct way: heavy blur + alpha threshold (ColorMatrix)
// applied as a layer over the group. State changes never snap — speed,
// wobble, breath and colors all morph via timed shared values.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type OrbState = 'flow' | 'chaos' | 'idle';

type Palette = [string, string, string];

interface MotionTargets {
  /** Time multiplier for the shared clock */
  speed: number;
  /** Orbit amplitude as a fraction of size */
  wobble: number;
  /** Breathing amplitude of the core ball (fraction of its radius) */
  breath: number;
  /** Ambient glow opacity behind the blob */
  glow: number;
}

// Wobble amplitudes are capped so that even at chaos the blurred metaball
// silhouette stays inside the canvas — nothing may ever touch the canvas
// edge, or OLED screens reveal the square bounds against true black.
const STATE_MOTION: Record<OrbState, MotionTargets> = {
  flow: { speed: 0.5, wobble: 0.05, breath: 0.05, glow: 0.45 },
  chaos: { speed: 2.4, wobble: 0.09, breath: 0.08, glow: 0.6 },
  idle: { speed: 0.22, wobble: 0.028, breath: 0.025, glow: 0.25 },
};

const STATE_COLORS: Record<OrbState, Palette> = {
  flow: ['#8B5CF6', '#6D28D9', '#4C1D95'],
  chaos: ['#F87171', '#EF4444', '#991B1B'],
  idle: ['#71717A', '#52525B', '#27272A'],
};

// State transition duration — slow enough to feel organic, fast enough
// to register as a response
const MORPH_MS = 1100;
const MORPH_EASING = Easing.inOut(Easing.cubic);

const TAU = Math.PI * 2;

interface LivingAuraOrbProps {
  state?: OrbState;
  size?: number;
}

export const LivingAuraOrb: React.FC<LivingAuraOrbProps> = ({ state = 'flow', size = 280 }) => {
  const reducedMotion = useReducedMotion();
  const center = size / 2;
  const baseRadius = size * 0.19;

  // ── Shared clock ──────────────────────────────────────────────────
  // A single accumulating clock scaled by a smooth `speed` value.
  // Retargeting speed never causes a phase jump, so state transitions
  // accelerate/decelerate the organism instead of restarting it.
  const clock = useSharedValue(2.4); // non-zero start = pleasing asymmetric pose when static
  const speed = useSharedValue(STATE_MOTION[state].speed);
  const wobble = useSharedValue(STATE_MOTION[state].wobble);
  const breath = useSharedValue(STATE_MOTION[state].breath);
  const glow = useSharedValue(STATE_MOTION[state].glow);

  useFrameCallback((info) => {
    const dt = (info.timeSincePreviousFrame ?? 16) / 1000;
    clock.value += dt * speed.value;
  }, !reducedMotion);

  // ── Color crossfade ───────────────────────────────────────────────
  const fromColors = useSharedValue<Palette>(STATE_COLORS[state]);
  const toColors = useSharedValue<Palette>(STATE_COLORS[state]);
  const colorProgress = useSharedValue(1);

  useEffect(() => {
    const motion = STATE_MOTION[state];
    const timing = { duration: MORPH_MS, easing: MORPH_EASING };

    fromColors.value = toColors.value;
    toColors.value = STATE_COLORS[state];
    colorProgress.value = 0;
    colorProgress.value = withTiming(1, timing);

    speed.value = withTiming(motion.speed, timing);
    wobble.value = withTiming(motion.wobble, timing);
    breath.value = withTiming(motion.breath, timing);
    glow.value = withTiming(motion.glow, timing);
  }, [state]);

  const colorA = useDerivedValue(() =>
    interpolateColor(colorProgress.value, [0, 1], [fromColors.value[0], toColors.value[0]])
  );
  const colorB = useDerivedValue(() =>
    interpolateColor(colorProgress.value, [0, 1], [fromColors.value[1], toColors.value[1]])
  );
  const colorC = useDerivedValue(() =>
    interpolateColor(colorProgress.value, [0, 1], [fromColors.value[2], toColors.value[2]])
  );

  // ── Metaball positions ────────────────────────────────────────────
  // Two harmonics per axis: the second, faster harmonic is what makes
  // chaos read as agitation instead of just "faster orbit".
  const ballAX = useDerivedValue(() => {
    const t = clock.value;
    const amp = size * wobble.value;
    return center + Math.cos(t * 0.9) * amp + Math.cos(t * 2.33) * amp * 0.4;
  });
  const ballAY = useDerivedValue(() => {
    const t = clock.value;
    const amp = size * wobble.value;
    return center + Math.sin(t * 1.1) * amp * 0.7 + Math.sin(t * 3.1) * amp * 0.3;
  });

  const ballBRadius = useDerivedValue(() => {
    return baseRadius * (1 + breath.value * Math.sin(clock.value * 1.7));
  });

  const ballCX = useDerivedValue(() => {
    const t = -clock.value * 0.6 + 2;
    const amp = size * wobble.value;
    return center + Math.cos(t) * amp * 0.9 + Math.cos(t * 2.7) * amp * 0.35;
  });
  const ballCY = useDerivedValue(() => {
    const t = -clock.value * 0.6 + 2;
    const amp = size * wobble.value;
    return center + Math.sin(t * 1.2) * amp * 0.6 + Math.sin(t * 2.1) * amp * 0.3;
  });

  const glowOpacity = useDerivedValue(() => glow.value);

  // The glow gradient must reach exactly zero alpha before the canvas edge.
  // A blurred circle can't guarantee that (its tail clips at the bounds and
  // lifts the whole canvas' black level — glaringly visible on OLED); a
  // radial gradient ending at 'transparent' decays to true black by design.
  const glowColors = useDerivedValue(() => [colorA.value, colorA.value, 'transparent']);

  // The metaball recipe: blur melts the circles together, then the
  // alpha threshold re-sharpens the union into one organic silhouette
  const gooLayer = (
    <Paint>
      <Blur blur={size * 0.075} />
      <ColorMatrix matrix={[1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 24, -11]} />
    </Paint>
  );

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Canvas style={{ width: size, height: size }}>
        {/* Ambient glow — radial gradient that hits zero alpha at r=0.48*size,
            safely inside the canvas, so no square edge can ever appear */}
        <Circle cx={center} cy={center} r={size * 0.48} opacity={glowOpacity}>
          <RadialGradient
            c={vec(center, center)}
            r={size * 0.48}
            colors={glowColors}
            positions={[0, 0.22, 1]}
          />
        </Circle>

        {/* The organism */}
        <Group layer={gooLayer}>
          <Circle cx={ballAX} cy={ballAY} r={baseRadius * 1.05} color={colorA} />
          <Circle cx={center} cy={center} r={ballBRadius} color={colorB} />
          <Circle cx={ballCX} cy={ballCY} r={baseRadius * 0.85} color={colorC} />
        </Group>

        {/* Specular highlight for depth */}
        <Group>
          <Blur blur={size * 0.05} />
          <Circle
            cx={center - size * 0.07}
            cy={center - size * 0.09}
            r={baseRadius * 0.4}
            color="white"
            opacity={0.14}
          />
        </Group>
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LivingAuraOrb;
