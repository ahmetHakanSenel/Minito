import React, { useState, useEffect, useMemo } from 'react';
import {
  TextInput,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sparkles, BrainCircuit } from 'lucide-react-native';
import { haptics } from '../lib/ui/haptics';
import { PRESS_SPRING, SETTLE_SPRING } from '../lib/ui/motion';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
  useAnimatedProps,
} from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { SoftGlow } from './SoftGlow';

interface TaskInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  placeholder?: string;
  onFocus?: () => void;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedPath = Animated.createAnimatedComponent(Path);

// The edge function's own ceiling for a task. Beyond it the text would be refused, so the
// field stops there and says so rather than letting someone write into nothing.
const TASK_MAX_LENGTH = 500;
// The counter stays out of the way until the limit is close enough to matter.
const COUNTER_VISIBLE_AT = 400;

// Generate SVG path for rounded rectangle
const getRoundedRectPath = (width: number, height: number, radius: number): string => {
  // Ensure radius doesn't exceed half of smallest dimension
  const r = Math.min(radius, width / 2, height / 2);

  return `
    M ${r} 0
    L ${width - r} 0
    Q ${width} 0 ${width} ${r}
    L ${width} ${height - r}
    Q ${width} ${height} ${width - r} ${height}
    L ${r} ${height}
    Q 0 ${height} 0 ${height - r}
    L 0 ${r}
    Q 0 0 ${r} 0
    Z
  `;
};

// Calculate perimeter of rounded rectangle
const getRoundedRectPerimeter = (width: number, height: number, radius: number): number => {
  const r = Math.min(radius, width / 2, height / 2);
  // Straight edges + quarter circles at corners
  const straightEdges = 2 * (width - 2 * r) + 2 * (height - 2 * r);
  const corners = 2 * Math.PI * r; // Full circle from 4 quarter circles
  return straightEdges + corners;
};

export const TaskInput: React.FC<TaskInputProps> = ({
  value,
  onChangeText,
  onSubmit,
  isLoading = false,
  placeholder,
  onFocus,
}) => {
  const { t } = useTranslation();
  const inputPlaceholder = placeholder || t('home.inputPlaceholder');
  const [hasFocused, setHasFocused] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [borderSize, setBorderSize] = useState<{ width: number; height: number } | null>(null);
  const buttonScale = useSharedValue(1);

  // Input glow animation
  const glowOpacity = useSharedValue(0.3); // Default subtle glow

  // Processing state - neon snake dash along border
  const dashOffset = useSharedValue(0);

  // Update glow based on focus state
  useEffect(() => {
    if (isFocused) {
      // Focus state: increase glow. Opacity that overshoots reads as a flicker, so it settles.
      glowOpacity.value = withSpring(0.8, SETTLE_SPRING);
    } else {
      // Default state: subtle glow
      glowOpacity.value = withSpring(0.3, SETTLE_SPRING);
    }
  }, [glowOpacity, isFocused]);

  // Border radius constant (must match rounded-2xl = 16px, but SVG uses 18 for better visual)
  const BORDER_RADIUS = 18;

  // Calculate perimeter and path when border size changes
  const { perimeter, pathD } = useMemo(() => {
    if (!borderSize) return { perimeter: 0, pathD: '' };

    const peri = getRoundedRectPerimeter(borderSize.width, borderSize.height, BORDER_RADIUS);
    const path = getRoundedRectPath(borderSize.width, borderSize.height, BORDER_RADIUS);

    return { perimeter: peri, pathD: path };
  }, [borderSize]);

  // Start snake animation only when processing (isLoading)
  useEffect(() => {
    if (isLoading && perimeter > 0) {
      // Full loop along the border - negative for clockwise
      dashOffset.value = withRepeat(
        withTiming(-perimeter, {
          // Slightly slower for calmer, more neon-like motion
          duration: 2600,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    } else {
      dashOffset.value = 0;
    }
  }, [dashOffset, isLoading, perimeter]);

  // Haptic feedback on first focus (when user starts typing)
  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
    if (!hasFocused) {
      haptics.selection();
      setHasFocused(true);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  // The heaviest tap in the app marks the moment an AI breakdown is committed.
  const handleSubmit = () => {
    haptics.commit();
    onSubmit();
  };

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: buttonScale.value,
      },
    ],
  }));

  const glowLayerStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const snakeBorderStyle = useAnimatedStyle(() => ({
    opacity: isLoading ? 1 : 0,
  }));

  const animatedStrokeProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  const handleInputWrapperLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBorderSize({ width, height });
  };

  return (
    <View className="w-full px-4">
      {/* Input with BrainCircuit icon and dynamic glow */}
      <View style={styles.inputWrapper} onLayout={handleInputWrapperLayout}>
        {/* Ambient focus glow — fades to nothing, leaves no edge on OLED */}
        <Animated.View style={[StyleSheet.absoluteFill, glowLayerStyle]} pointerEvents="none">
          <SoftGlow color="#8B5CF6" intensity={0.5} spread={26} />
        </Animated.View>

        {/* Processing State: Neon Snake Border (only when loading) */}
        {isLoading && borderSize && perimeter > 0 && (
          <Animated.View
            style={[styles.snakeBorderContainer, snakeBorderStyle]}
            pointerEvents="none"
          >
            <Svg
              width={borderSize.width + 6}
              height={borderSize.height + 6}
              viewBox={`-3 -3 ${borderSize.width + 6} ${borderSize.height + 6}`}
            >
              <Defs>
                <SvgLinearGradient id="neonSnakeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#E0D4FF" stopOpacity="1" />
                  <Stop offset="40%" stopColor="#A855F7" stopOpacity="1" />
                  <Stop offset="70%" stopColor="#34D399" stopOpacity="1" />
                  <Stop offset="100%" stopColor="#60A5FA" stopOpacity="1" />
                </SvgLinearGradient>
              </Defs>
              {/* Soft outer glow for extra neon feeling */}
              <AnimatedPath
                d={pathD}
                fill="none"
                stroke="url(#neonSnakeGradient)"
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={`${perimeter * 0.25}, ${perimeter * 0.75}`}
                animatedProps={animatedStrokeProps}
                opacity={0.6}
              />
              {/* Core bright snake segment traveling along the border */}
              <AnimatedPath
                d={pathD}
                fill="none"
                stroke="url(#neonSnakeGradient)"
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={`${perimeter * 0.25}, ${perimeter * 0.75}`}
                animatedProps={animatedStrokeProps}
              />
            </Svg>
          </Animated.View>
        )}

        <View style={styles.inputInner}>
          <TextInput
            className="bg-surface text-textMain rounded-2xl px-4 py-4 pl-12 text-base"
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={inputPlaceholder}
            placeholderTextColor="#A1A1AA"
            accessibilityLabel={t('home.inputLabel')}
            multiline
            maxLength={TASK_MAX_LENGTH}
            editable={!isLoading}
            style={{
              color: '#E5E5E5',
              minHeight: 120,
              textAlignVertical: 'top',
              borderWidth: 1,
              borderColor: isLoading ? 'transparent' : '#2A2A2A',
            }}
          />
          {/* BrainCircuit icon inside input */}
          <View className="absolute left-4 top-4">
            <BrainCircuit size={20} color="#A1A1AA" strokeWidth={2.5} />
          </View>
          {value.length >= COUNTER_VISIBLE_AT ? (
            <Text
              className="absolute right-3 bottom-2 text-xs text-textMuted"
              accessibilityLabel={t('home.charactersLeft', {
                count: TASK_MAX_LENGTH - value.length,
              })}
            >
              {value.length} / {TASK_MAX_LENGTH}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Primary action: starts a breakdown, with the app's one heavy haptic */}
      <AnimatedTouchableOpacity
        onPressIn={() => {
          buttonScale.value = withSpring(0.96, PRESS_SPRING);
        }}
        onPressOut={() => {
          buttonScale.value = withSpring(1, PRESS_SPRING);
        }}
        onPress={handleSubmit}
        disabled={!value.trim() || isLoading}
        accessibilityRole="button"
        accessibilityState={{ disabled: !value.trim() || isLoading, busy: isLoading }}
        className={`mt-4 rounded-2xl py-4 px-6 flex-row items-center justify-center gap-2 ${
          value.trim() && !isLoading ? 'bg-primary' : 'bg-gray-700 opacity-50'
        }`}
        style={buttonStyle}
      >
        {!isLoading && <Sparkles size={20} color="#FFFFFF" strokeWidth={2.5} />}
        <Text className="text-white text-center font-semibold text-lg">
          {isLoading ? t('home.breaking') : t('home.breakButton')}
        </Text>
      </AnimatedTouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  inputWrapper: {
    position: 'relative',
  },
  snakeBorderContainer: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 20,
    zIndex: 0,
    overflow: 'visible',
  },
  inputInner: {
    position: 'relative',
    zIndex: 1,
  },
});
