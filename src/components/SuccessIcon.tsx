import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import {
  BrainCircuit,
  Wind,
  Trophy,
  Zap,
  Rocket,
  Sparkles,
  Music,
  Ghost,
  Target,
  Crown,
  type LucideIcon,
} from 'lucide-react-native';

// Icon mapping for dynamic icon selection
const ICON_MAP: Record<string, LucideIcon> = {
  BrainCircuit,
  Wind,
  Trophy,
  Zap,
  Rocket,
  Sparkles,
  Music,
  Ghost,
  Target,
  Crown,
};

interface SuccessIconProps {
  iconName: string;
  color: string;
  size?: number;
  animated?: boolean;
}

/**
 * SuccessIcon - Large, glowing Lucide icon for success messages
 * Displays a dynamic icon with color-specific glow effect
 */
export const SuccessIcon: React.FC<SuccessIconProps> = ({
  iconName,
  color,
  size = 80,
  animated = true,
}) => {
  const scale = useSharedValue(0);
  const iconScale = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(1);

  // Get the icon component
  const IconComponent = ICON_MAP[iconName] || Sparkles;

  useEffect(() => {
    if (animated) {
      // Initial scale animation - Spring Physics
      scale.value = withSpring(1, {
        damping: 12,
        mass: 0.8,
        stiffness: 150,
      });

      // Icon appears with delay
      iconScale.value = withDelay(
        200,
        withSpring(1, {
          damping: 10,
          stiffness: 150,
        })
      );

      // Continuous glow pulse - Spring Physics
      glowOpacity.value = withRepeat(
        withSequence(
          withSpring(0.8, { damping: 10, stiffness: 80 }),
          withSpring(0.4, { damping: 10, stiffness: 80 })
        ),
        -1,
        true
      );

      glowScale.value = withRepeat(
        withSequence(
          withSpring(1.15, { damping: 10, stiffness: 80 }),
          withSpring(1, { damping: 10, stiffness: 80 })
        ),
        -1,
        true
      );
    } else {
      scale.value = 1;
      iconScale.value = 1;
      glowOpacity.value = 0.6;
      glowScale.value = 1;
    }
  }, [animated, glowOpacity, glowScale, iconScale, scale]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconScale.value,
    transform: [{ scale: iconScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => {
    const opacity = interpolate(glowOpacity.value, [0, 1], [0.3, 0.8], Extrapolate.CLAMP);
    return {
      opacity,
      transform: [{ scale: glowScale.value }],
    };
  });

  return (
    <View style={[styles.container, { width: size * 1.5, height: size * 1.5 }]}>
      {/* Glow effect */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: size * 1.5,
            height: size * 1.5,
            borderRadius: (size * 1.5) / 2,
            backgroundColor: color,
            shadowColor: color,
          },
          glowStyle,
        ]}
      />

      {/* Main icon container */}
      <Animated.View style={containerStyle}>
        <Animated.View style={iconStyle}>
          <IconComponent size={size} color={color} strokeWidth={2.5} />
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
  },
});
