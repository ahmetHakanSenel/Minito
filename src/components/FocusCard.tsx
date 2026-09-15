import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2 } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
  FadeInDown,
  SlideOutRight,
  LinearTransition,
} from 'react-native-reanimated';
import { haptics } from '../lib/ui/haptics';

interface FocusCardProps {
  step: string;
  stepNumber: number;
  totalSteps: number;
  onComplete?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  isCompleted?: boolean;
  isFinalStep?: boolean;
  disabled?: boolean;
  timerSlot?: React.ReactNode;
  timerCompletionLoop?: boolean;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedView = Animated.createAnimatedComponent(View);

export const FocusCard: React.FC<FocusCardProps> = ({
  step,
  stepNumber,
  totalSteps,
  onComplete,
  onNext,
  onPrevious,
  isCompleted = false,
  isFinalStep = false,
  disabled = false,
  timerSlot,
  timerCompletionLoop = false,
}) => {
  const { t } = useTranslation();

  // Button press animations
  const nextPressed = useSharedValue(0);
  const prevPressed = useSharedValue(0);
  const completePressed = useSharedValue(0);

  // Border pulse animation for timer completion
  const borderPulseOpacity = useSharedValue(0);

  // Start/stop border pulse when timer completion state changes
  useEffect(() => {
    if (timerCompletionLoop) {
      // Start pulsing border animation
      borderPulseOpacity.value = withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
    } else {
      // Stop pulsing and reset
      borderPulseOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [timerCompletionLoop]);

  // Animated border style for timer completion pulse
  const cardBorderStyle = useAnimatedStyle(() => {
    const opacity = borderPulseOpacity.value;
    return {
      borderColor:
        opacity > 0 ? `rgba(168, 85, 247, ${0.3 + opacity * 0.7})` : 'rgba(55, 65, 81, 1)', // gray-800
      borderWidth: opacity > 0 ? 2 : 1,
      shadowColor: '#A855F7',
      shadowOpacity: opacity * 0.5,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 0 },
    };
  });

  // A firm press on checking a step off; the focus screen layers the success pattern on top.
  const handleComplete = () => {
    haptics.press();
    onComplete?.();
  };

  const handleNext = () => {
    haptics.tap();
    onNext?.();
  };

  const handlePrevious = () => {
    haptics.tap();
    onPrevious?.();
  };

  // Button press styles with Spring Physics
  const nextButtonStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(nextPressed.value ? 0.96 : 1, {
          damping: 10,
          stiffness: 200,
        }),
      },
    ],
  }));

  const prevButtonStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(prevPressed.value ? 0.96 : 1, {
          damping: 10,
          stiffness: 200,
        }),
      },
    ],
  }));

  const completeButtonStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withSpring(completePressed.value ? 0.96 : 1, {
          damping: 10,
          stiffness: 200,
        }),
      },
    ],
  }));

  return (
    <View style={{ backgroundColor: 'transparent', paddingHorizontal: 0, zIndex: 10 }}>
      {/* Card Entry Animation - Spring Physics */}
      <AnimatedView
        className="bg-surface rounded-3xl p-8 border border-gray-800"
        entering={FadeInDown.springify().damping(12).mass(0.8).stiffness(150)}
        layout={LinearTransition.springify().damping(15)}
        style={[{ zIndex: 10 }, cardBorderStyle]}
      >
        {/* Step Counter */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-textMuted text-sm">
            {t('focus.step', { current: stepNumber, total: totalSteps })}
          </Text>
          {isCompleted && (
            <AnimatedView
              className="bg-success/20 px-3 py-1 rounded-full"
              entering={FadeInDown.springify().damping(12).mass(0.8).stiffness(150)}
            >
              <Text className="text-success text-xs font-semibold">{t('focus.completed')}</Text>
            </AnimatedView>
          )}
        </View>

        {/* Step Content */}
        <Text className="text-textMain text-2xl font-semibold leading-8 mb-8">{step}</Text>

        {/* Timer Slot with Divider - Only rendered when timerSlot is provided */}
        {timerSlot && (
          <View style={{ marginBottom: 24 }}>
            {/* Subtle Divider */}
            <View
              style={{
                height: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                marginBottom: 16,
                marginHorizontal: -32, // Extend to card edges (counteract p-8)
              }}
            />
            {/* Timer Content */}
            {timerSlot}
          </View>
        )}

        {/* Actions */}
        <View className="flex-row gap-3">
          {onPrevious && stepNumber > 1 && (
            <AnimatedTouchableOpacity
              onPressIn={() => {
                prevPressed.value = 1;
              }}
              onPressOut={() => {
                prevPressed.value = 0;
              }}
              onPress={handlePrevious}
              disabled={disabled}
              className={`flex-1 rounded-xl py-4 ${disabled ? 'bg-gray-800/60' : 'bg-gray-800'}`}
              style={prevButtonStyle}
            >
              <Text className="text-textMain text-center font-medium">{t('focus.previous')}</Text>
            </AnimatedTouchableOpacity>
          )}

          {onNext && stepNumber < totalSteps && (
            <AnimatedTouchableOpacity
              onPressIn={() => {
                nextPressed.value = 1;
              }}
              onPressOut={() => {
                nextPressed.value = 0;
              }}
              onPress={handleNext}
              disabled={disabled}
              className={`flex-1 rounded-xl py-4 flex-row items-center justify-center gap-2 ${disabled ? 'bg-primary/60' : 'bg-primary'}`}
              style={nextButtonStyle}
            >
              <Text className="text-white text-center font-semibold">{t('focus.next')}</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </AnimatedTouchableOpacity>
          )}

          {onComplete && stepNumber === totalSteps && (
            <AnimatedTouchableOpacity
              onPressIn={() => {
                completePressed.value = 1;
              }}
              onPressOut={() => {
                completePressed.value = 0;
              }}
              onPress={handleComplete}
              disabled={disabled}
              className={`flex-1 rounded-xl py-4 flex-row items-center justify-center gap-2 ${disabled ? 'bg-success/60' : 'bg-success'}`}
              style={completeButtonStyle}
            >
              <Text className="text-white text-center font-semibold">{t('focus.complete')}</Text>
              <CheckCircle2 size={18} color="#FFFFFF" strokeWidth={2.5} />
            </AnimatedTouchableOpacity>
          )}
        </View>
      </AnimatedView>
    </View>
  );
};
