import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  cancelAnimation,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import Svg, { Path, Circle, G, Defs, RadialGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PremiumStepAnimationProps {
  visible: boolean;
  onComplete?: () => void;
  isFinalStep?: boolean;
}


const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

export const PremiumStepAnimation: React.FC<PremiumStepAnimationProps> = ({
  visible,
  onComplete,
  isFinalStep = false,
}) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotation = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(1);
  const checkmarkProgress = useSharedValue(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      // Cancel any running animations first
      cancelAnimation(scale);
      cancelAnimation(opacity);
      cancelAnimation(rotation);
      cancelAnimation(glowOpacity);
      cancelAnimation(glowScale);
      cancelAnimation(checkmarkProgress);
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Reset all values to initial state
      scale.value = 0;
      opacity.value = 0;
      rotation.value = 0;
      glowOpacity.value = 0;
      glowScale.value = 1;
      checkmarkProgress.value = 0;


      // Main container animation - Spring Physics
      scale.value = withSpring(1, {
        damping: 12,
        mass: 0.8,
        stiffness: 150,
      });
      
      opacity.value = withTiming(1, { duration: 200 });
      
      rotation.value = withSpring(1, {
        damping: 15,
        stiffness: 100,
      });

      // Glow pulse - Spring Physics
      glowOpacity.value = withRepeat(
        withSequence(
          withSpring(1, { damping: 10, stiffness: 80 }),
          withSpring(0.3, { damping: 10, stiffness: 80 })
        ),
        3,
        false
      );

      glowScale.value = withRepeat(
        withSequence(
          withSpring(1.4, { damping: 10, stiffness: 80 }),
          withSpring(1, { damping: 10, stiffness: 80 })
        ),
        3,
        false
      );

      // Checkmark drawing animation (handled separately for SVG)
      checkmarkProgress.value = withDelay(
        200,
        withSpring(1, {
          damping: 12,
          stiffness: 120,
        })
      );
      


      // Hide after animation
      timeoutRef.current = setTimeout(() => {
        scale.value = withSpring(0, { damping: 12, stiffness: 150 });
        opacity.value = withTiming(0, { duration: 300 });
        onComplete?.();
        timeoutRef.current = null;
      }, isFinalStep ? 3000 : 2500);
    } else {
      // When visible becomes false, immediately cancel all animations and reset
      cancelAnimation(scale);
      cancelAnimation(opacity);
      cancelAnimation(rotation);
      cancelAnimation(glowOpacity);
      cancelAnimation(glowScale);
      cancelAnimation(checkmarkProgress);
      
      // Clear timeout if exists
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Reset all values to initial state
      scale.value = 0;
      opacity.value = 0;
      rotation.value = 0;
      glowOpacity.value = 0;
      glowScale.value = 1;
      checkmarkProgress.value = 0;
    }

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      cancelAnimation(scale);
      cancelAnimation(opacity);
      cancelAnimation(rotation);
      cancelAnimation(glowOpacity);
      cancelAnimation(glowScale);
      cancelAnimation(checkmarkProgress);
    };
  }, [visible, isFinalStep]);

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${interpolate(rotation.value, [0, 1], [0, 360], Extrapolate.CLAMP)}deg` },
    ],
    opacity: opacity.value,
  }));

  const glowStyle1 = useAnimatedStyle(() => ({
    opacity: interpolate(glowOpacity.value, [0, 1], [0.4, 1], Extrapolate.CLAMP),
    transform: [{ scale: glowScale.value }],
  }));

  const glowStyle2 = useAnimatedStyle(() => ({
    opacity: interpolate(glowOpacity.value, [0, 1], [0.2, 0.6], Extrapolate.CLAMP),
    transform: [{ scale: interpolate(glowScale.value, [1, 1.4], [1.2, 1.6], Extrapolate.CLAMP) }],
  }));

  // Checkmark overlay animated style (only animated properties)
  const checkmarkOverlayStyle = useAnimatedStyle(() => ({
    opacity: checkmarkProgress.value,
    transform: [{ scale: checkmarkProgress.value }],
  }));

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="auto">
      {/* Subtle dimmed backdrop to block touches and focus attention */}
      <View style={styles.backdrop} />
      {/* Multiple glow layers */}
      <Animated.View style={[styles.glowLayer1, glowStyle1]} />
      <Animated.View style={[styles.glowLayer2, glowStyle2]} />

      {/* Main SVG icon */}
      <Animated.View style={containerStyle}>
        <Svg width={140} height={140} viewBox="0 0 140 140">
          <Defs>
            <RadialGradient id="gradient" cx="50%" cy="50%">
              <Stop offset="0%" stopColor="#34D399" stopOpacity="1" />
              <Stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
            </RadialGradient>
          </Defs>

          {/* Outer ring */}
          <Circle
            cx="70"
            cy="70"
            r="65"
            fill="none"
            stroke="url(#gradient)"
            strokeWidth="2"
            opacity="0.5"
          />

          {/* Main circle */}
          <Circle
            cx="70"
            cy="70"
            r="60"
            fill="url(#gradient)"
            opacity="0.9"
          />

          {/* Inner highlight */}
          <Circle
            cx="70"
            cy="70"
            r="50"
            fill="none"
            stroke="white"
            strokeWidth="1"
            opacity="0.3"
          />
        </Svg>
      </Animated.View>
      
      {/* Checkmark with opacity and scale animation - perfectly centered */}
      <Animated.View
        style={[styles.checkmarkOverlay, checkmarkOverlayStyle]}
        pointerEvents="none"
      >
        <Svg width={60} height={60} viewBox="0 0 60 60">
          <Path
            d="M10 30 L25 45 L50 10"
            stroke="white"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  glowLayer1: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#34D399',
    shadowColor: '#34D399',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 50,
  },
  glowLayer2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 60,
  },
  checkmarkOverlay: {
    position: 'absolute',
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
