import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';

// Type for the confetti cannon ref (it's a class component with start/resume/stop methods)
type ConfettiCannonRef = React.ComponentRef<typeof ConfettiCannon>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Brand colors: Neon Purple, Mint, Yellow, Pink, Light Gray
const BRAND_COLORS = ['#8B5CF6', '#34D399', '#EAB308', '#EC4899', '#E5E5E5'];

interface ConfettiAnimationProps {
  visible: boolean;
  onComplete?: () => void;
  onAnimationStart?: () => void;
}

/**
 * ConfettiAnimation - "Dopamine Finale" with dual confetti cannons
 * Two cannons positioned at bottom-left and bottom-right corners
 * Explode upward and outward creating a grand finale effect
 */
export const ConfettiAnimation: React.FC<ConfettiAnimationProps> = ({
  visible,
  onComplete,
  onAnimationStart,
}) => {
  const leftCannonRef = useRef<ConfettiCannonRef>(null);
  const rightCannonRef = useRef<ConfettiCannonRef>(null);
  const leftFinishedRef = useRef(false);
  const rightFinishedRef = useRef(false);

  // Reset completion flags when animation starts
  useEffect(() => {
    if (visible) {
      leftFinishedRef.current = false;
      rightFinishedRef.current = false;
    }
  }, [visible]);

  const checkBothComplete = () => {
    if (leftFinishedRef.current && rightFinishedRef.current && onComplete) {
      onComplete();
    }
  };

  useEffect(() => {
    if (visible) {
      // Trigger haptics at the exact moment of explosion
      onAnimationStart?.();

      // Trigger both cannons simultaneously for the grand finale
      // Small delay to ensure refs are ready
      const timer = setTimeout(() => {
        leftCannonRef.current?.start();
        rightCannonRef.current?.start();
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [visible, onAnimationStart]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Bottom-Left Cannon: Shoots up-right */}
      <ConfettiCannon
        ref={leftCannonRef}
        count={100}
        origin={{ x: 0, y: SCREEN_HEIGHT }}
        explosionSpeed={350}
        fallSpeed={3000}
        fadeOut={true}
        colors={BRAND_COLORS}
        autoStart={false}
        onAnimationEnd={() => {
          leftFinishedRef.current = true;
          checkBothComplete();
        }}
      />

      {/* Bottom-Right Cannon: Shoots up-left */}
      <ConfettiCannon
        ref={rightCannonRef}
        count={100}
        origin={{ x: SCREEN_WIDTH, y: SCREEN_HEIGHT }}
        explosionSpeed={350}
        fallSpeed={3000}
        fadeOut={true}
        colors={BRAND_COLORS}
        autoStart={false}
        onAnimationEnd={() => {
          rightFinishedRef.current = true;
          checkBothComplete();
        }}
      />
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
    zIndex: 1000,
  },
});
