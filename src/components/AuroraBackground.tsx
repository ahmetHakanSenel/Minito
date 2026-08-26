import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';
import { useAuroraContext } from '../lib/aurora';

const AnimatedView = Animated.createAnimatedComponent(View);

export const AuroraBackground: React.FC = () => {
  const { width, height } = useWindowDimensions();
  const { isCompletionPulse } = useAuroraContext();

  // Primary Blob (Violet/Purple) - Top-Left
  const primaryOpacity = useSharedValue(0.32);

  // Anchor Blob (Dark Blue) - Bottom-Right
  const anchorOpacity = useSharedValue(0.28);

  // Breathing drift - very slow, lava lamp effect
  const primaryDriftX = useSharedValue(0);
  const primaryDriftY = useSharedValue(0);
  const anchorDriftX = useSharedValue(0);
  const anchorDriftY = useSharedValue(0);

  // Normal breathing animation
  useEffect(() => {
    if (isCompletionPulse) return; // Don't set normal animation during completion

    // Breathing effect - extremely slow pulse (8-12s), lava lamp feel
    const breathe = { duration: 10000, easing: Easing.inOut(Easing.ease) };
    primaryOpacity.value = withRepeat(withTiming(0.48, breathe), -1, true);
    anchorOpacity.value = withDelay(2000, withRepeat(withTiming(0.42, breathe), -1, true));

    // Very slow drift - lava lamp movement (15-20s cycles)
    const lavaDrift = { duration: 18000, easing: Easing.inOut(Easing.ease) };
    primaryDriftX.value = withRepeat(withTiming(30, lavaDrift), -1, true);
    primaryDriftY.value = withDelay(3000, withRepeat(withTiming(25, lavaDrift), -1, true));
    anchorDriftX.value = withDelay(5000, withRepeat(withTiming(-28, lavaDrift), -1, true));
    anchorDriftY.value = withDelay(7000, withRepeat(withTiming(-22, lavaDrift), -1, true));
  }, [isCompletionPulse]);

  // Completion pulse - faster, more intense
  useEffect(() => {
    if (isCompletionPulse) {
      // Cancel normal animations
      cancelAnimation(primaryOpacity);
      cancelAnimation(anchorOpacity);

      // Fast, intense pulse for completion
      const completionPulse = { duration: 1200, easing: Easing.inOut(Easing.sin) };
      primaryOpacity.value = withRepeat(withTiming(0.7, completionPulse), -1, true);
      anchorOpacity.value = withRepeat(withTiming(0.6, completionPulse), -1, true);
    }
  }, [isCompletionPulse]);

  const primaryStyle = useAnimatedStyle(() => ({
    opacity: primaryOpacity.value,
    transform: [
      { translateX: primaryDriftX.value },
      { translateY: primaryDriftY.value },
      { scale: 1.08 },
    ],
  }));

  const anchorStyle = useAnimatedStyle(() => ({
    opacity: anchorOpacity.value,
    transform: [
      { translateX: anchorDriftX.value },
      { translateY: anchorDriftY.value },
      { scale: 1.08 },
    ],
  }));

  const blobSize = {
    width: width * 0.9,
    height: height * 0.9,
  };

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Deep Void Base - NOT pure black */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Rect width={width} height={height} fill="#050510" />
      </Svg>

      {/* Primary Blob (Violet/Purple) - Top-Left, bleeding in from off-screen */}
      <AnimatedView
        style={[
          styles.cluster,
          {
            left: -width * 0.45,
            top: -height * 0.15,
            width: blobSize.width,
            height: blobSize.height
          },
          primaryStyle,
        ]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            {/*
              Centred at 50%/50% with r=50% so the last (fully transparent)
              stop lands exactly on the rect boundary. Any off-centre centre
              or larger radius leaves residual opacity along the near edges,
              which reads as a hard line against true black on OLED.
            */}
            <RadialGradient id="primary1" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#A78BFA" stopOpacity="0.50" />
              <Stop offset="45%" stopColor="#8B5CF6" stopOpacity="0.22" />
              <Stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="primary2" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#C4B5FD" stopOpacity="0.34" />
              <Stop offset="55%" stopColor="#A78BFA" stopOpacity="0.14" />
              <Stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#primary1)" />
          <Rect width="100%" height="100%" fill="url(#primary2)" />
        </Svg>
      </AnimatedView>

      {/* Anchor Blob (Dark Blue) - Bottom-Right */}
      <AnimatedView
        style={[
          styles.cluster,
          {
            right: -width * 0.45,
            bottom: -height * 0.15,
            width: blobSize.width,
            height: blobSize.height
          },
          anchorStyle,
        ]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            {/* Same rule as the primary blob: fade must complete on the edge */}
            <RadialGradient id="anchor1" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#3B82F6" stopOpacity="0.40" />
              <Stop offset="45%" stopColor="#2563EB" stopOpacity="0.18" />
              <Stop offset="100%" stopColor="#1E40AF" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="anchor2" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#60A5FA" stopOpacity="0.28" />
              <Stop offset="55%" stopColor="#3B82F6" stopOpacity="0.12" />
              <Stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#anchor1)" />
          <Rect width="100%" height="100%" fill="url(#anchor2)" />
        </Svg>
      </AnimatedView>
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
    zIndex: 0,
  },
  cluster: {
    position: 'absolute',
    zIndex: 0,
  },
});

