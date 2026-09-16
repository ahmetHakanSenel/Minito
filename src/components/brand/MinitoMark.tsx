import React, { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

// Same geometry as scripts/build-brand-assets.ts, which renders the app icons from it.
const MARK_PATH = 'M26 94 V64 A14 14 0 0 1 54 64 V94 M54 94 V48 A14 14 0 0 1 82 48 V94';
const SPARK_PATH =
  'M99 10 Q101.2 19.8 111 22 Q101.2 24.2 99 34 Q96.8 24.2 87 22 Q96.8 19.8 99 10 Z';
// The mark's own bounds in the 120-unit design grid, squared and padded.
const VIEW_BOX = '16 6 98 98';

type MinitoMarkProps = {
  size?: number;
  /** A flat colour instead of the brand gradient, for monochrome surfaces. */
  color?: string;
};

/**
 * The Minito mark: a lowercase "m" whose second arch climbs higher than the first, with a spark
 * at the top. Small steps, going up.
 */
export function MinitoMark({ size = 64, color }: MinitoMarkProps) {
  // Gradient ids must be unique per instance; useId's colons are not valid in a url() reference.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const strokeId = `minitoStroke${id}`;
  const sparkId = `minitoSpark${id}`;

  return (
    <Svg width={size} height={size} viewBox={VIEW_BOX} accessibilityRole="image">
      {color ? null : (
        <Defs>
          <LinearGradient
            id={strokeId}
            x1="20"
            y1="100"
            x2="90"
            y2="30"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#7C3AED" />
            <Stop offset="0.55" stopColor="#A855F7" />
            <Stop offset="1" stopColor="#E879F9" />
          </LinearGradient>
          <LinearGradient
            id={sparkId}
            x1="87"
            y1="10"
            x2="111"
            y2="34"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#F5D0FE" />
            <Stop offset="1" stopColor="#E879F9" />
          </LinearGradient>
        </Defs>
      )}
      <Path
        d={MARK_PATH}
        fill="none"
        stroke={color ?? `url(#${strokeId})`}
        strokeWidth={13}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d={SPARK_PATH} fill={color ?? `url(#${sparkId})`} />
    </Svg>
  );
}
