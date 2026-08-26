import React, { useId } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

interface SoftGlowProps {
  /** Glow colour */
  color?: string;
  /** Peak opacity at the centre (0-1) */
  intensity?: number;
  /** How far the glow reaches beyond its parent, in px */
  spread?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * An ambient glow that is safe on OLED panels.
 *
 * Android's `elevation` derives its shadow from the view outline and falls
 * back to the raw rectangular bounds when the view has no opaque background,
 * producing a hard-edged grey box against true black. This draws the glow
 * as a radial gradient instead: the final stop is fully transparent and sits
 * exactly on the boundary, so the falloff always completes and no edge can
 * ever appear — identical on iOS and Android.
 */
export const SoftGlow: React.FC<SoftGlowProps> = ({
  color = '#8B5CF6',
  intensity = 0.5,
  spread = 24,
  style,
}) => {
  // SVG def ids share a namespace; a stable unique id keeps multiple glows
  // on the same screen from resolving to each other's gradient.
  const gradientId = `soft-glow-${useId().replace(/:/g, '')}`;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { margin: -spread }, style]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={intensity} />
            <Stop offset="55%" stopColor={color} stopOpacity={intensity * 0.32} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
};

export default SoftGlow;
