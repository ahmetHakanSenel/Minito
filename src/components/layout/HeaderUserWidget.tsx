import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { LayoutGrid } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { haptics } from '../../lib/ui/haptics';
import { PRESS_SPRING } from '../../lib/ui/motion';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

interface HeaderUserWidgetProps {
  onPress: () => void;
}

export const HeaderUserWidget: React.FC<HeaderUserWidgetProps> = ({ onPress }) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.92, PRESS_SPRING);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, PRESS_SPRING);
  };

  const handlePress = () => {
    haptics.tap();
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchableOpacity
      style={[styles.container, animatedStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <LayoutGrid size={20} color="#FFFFFF" strokeWidth={2} />
    </AnimatedTouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
