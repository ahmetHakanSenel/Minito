import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { LivingAuraOrb, type OrbState } from './LivingAuraOrb';
import { haptics } from '../../lib/ui/haptics';

// Title tint per state — lighter than the orb colors so text stays readable
const TITLE_COLORS: Record<OrbState, string> = {
  flow: '#C4B5FD',
  chaos: '#FCA5A5',
  idle: '#A1A1AA',
};

const STATE_ORDER: OrbState[] = ['flow', 'chaos', 'idle'];

interface FlowStateVisualizerProps {
  /** Focus quality score 0-100 */
  focusQuality: number;
  /** Distraction level 0-100 */
  distractionLevel: number;
  /** Long-press the orb to cycle states (dev builds only by default) */
  enableDebugMode?: boolean;
}

const calculateFlowState = (focusQuality: number, distractionLevel: number): OrbState => {
  if (focusQuality === 0 && distractionLevel === 0) return 'idle';
  if (distractionLevel > 50 || focusQuality < 40) return 'chaos';
  return 'flow';
};

export const FlowStateVisualizer: React.FC<FlowStateVisualizerProps> = ({
  focusQuality,
  distractionLevel,
  enableDebugMode = __DEV__,
}) => {
  const { t } = useTranslation();

  const calculatedState = useMemo(
    () => calculateFlowState(focusQuality, distractionLevel),
    [focusQuality, distractionLevel]
  );

  const [currentState, setCurrentState] = useState<OrbState>(calculatedState);
  const [isDebugOverride, setIsDebugOverride] = useState(false);

  useEffect(() => {
    if (!isDebugOverride) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the shown state follows the calculated one unless a demo overrides it
      setCurrentState(calculatedState);
    }
  }, [calculatedState, isDebugOverride]);

  const handleLongPress = useCallback(() => {
    if (!enableDebugMode) return;
    haptics.press();
    setCurrentState((prev) => STATE_ORDER[(STATE_ORDER.indexOf(prev) + 1) % STATE_ORDER.length]);
    setIsDebugOverride(true);
  }, [enableDebugMode]);

  return (
    <Animated.View entering={FadeIn.duration(800)} style={styles.container}>
      {/* In a release build there is nothing to press, so it is not a button: the orb is a
          picture of what the two lines under it already say. */}
      {enableDebugMode ? (
        <Pressable onLongPress={handleLongPress} delayLongPress={400} style={styles.orbContainer}>
          <LivingAuraOrb state={currentState} />
        </Pressable>
      ) : (
        <View
          style={styles.orbContainer}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <LivingAuraOrb state={currentState} />
        </View>
      )}

      <Animated.Text
        entering={FadeIn.delay(300).duration(600)}
        style={[styles.flowLabel, { color: TITLE_COLORS[currentState] }]}
      >
        {t(`flowState.${currentState}.title`)}
      </Animated.Text>

      <Animated.Text entering={FadeIn.delay(450).duration(500)} style={styles.flowSubtitle}>
        {t(`flowState.${currentState}.subtitle`)}
      </Animated.Text>

      {isDebugOverride && enableDebugMode && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.debugIndicator}>
          <Text style={styles.debugText}>DEV MODE</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  flowLabel: {
    fontSize: 20,
    fontWeight: '300',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  flowSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
    paddingHorizontal: 40,
    lineHeight: 18,
  },
  debugIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  debugText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 1,
  },
});

export default FlowStateVisualizer;
