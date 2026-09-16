import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, CircleCheck } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { haptics } from '../lib/ui/haptics';
import type { BreakdownStep } from '../lib/breakdownSteps';

interface FocusCardProps {
  step: BreakdownStep;
  stoppingPoint?: string;
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
  stoppingPoint,
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
  const actionScale = useSharedValue(1);
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = timerCompletionLoop
      ? withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true)
      : withTiming(0, { duration: 250 });
  }, [timerCompletionLoop, pulse]);

  const actionStyle = useAnimatedStyle(() => ({
    transform: [{ scale: actionScale.value }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: timerCompletionLoop
      ? `rgba(167, 139, 250, ${0.35 + pulse.value * 0.45})`
      : 'rgba(255,255,255,0.10)',
    shadowOpacity: timerCompletionLoop ? 0.12 + pulse.value * 0.2 : 0,
  }));

  const handlePress = (callback?: () => void) => {
    if (disabled || !callback) return;
    haptics.tap();
    callback();
  };

  const primaryAction = isFinalStep ? onComplete : onNext;

  return (
    <AnimatedView entering={FadeInDown.duration(300)} style={styles.screenSection}>
      <AnimatedView style={[styles.card, cardStyle]}>
        <View style={styles.cardHeader}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{stepNumber}</Text>
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{t('focus.step', { current: stepNumber, total: totalSteps })}</Text>
            {step.difficulty ? (
              <Text style={styles.difficulty}>{t(`focus.difficulty.${step.difficulty}`)}</Text>
            ) : null}
          </View>
          {isCompleted && <CircleCheck size={22} color="#34D399" strokeWidth={2.2} />}
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(stepNumber / totalSteps) * 100}%` }]} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{step.title}</Text>
          {step.instruction ? <Text style={styles.instruction}>{step.instruction}</Text> : null}
          {stoppingPoint ? (
            <View style={styles.stoppingPoint}>
              <Text style={styles.stoppingPointLabel}>{t('focus.stoppingPoint')}</Text>
              <Text style={styles.stoppingPointText}>{stoppingPoint}</Text>
            </View>
          ) : null}
        </View>

        {timerSlot ? <View style={styles.timerSection}>{timerSlot}</View> : null}

        <View style={styles.actions}>
          {onPrevious ? (
            <TouchableOpacity
              onPress={() => handlePress(onPrevious)}
              disabled={disabled}
              style={[styles.secondaryButton, disabled && styles.disabledButton]}
              accessibilityRole="button"
              accessibilityLabel={t('focus.previous')}
            >
              <ArrowLeft size={17} color="#D4D4D8" strokeWidth={2.2} />
            </TouchableOpacity>
          ) : null}

          <AnimatedTouchableOpacity
            onPress={() => handlePress(primaryAction)}
            disabled={disabled}
            style={[styles.primaryButton, isFinalStep && styles.completeButton, disabled && styles.disabledButton, actionStyle]}
            onPressIn={() => {
              actionScale.value = withSpring(0.97);
            }}
            onPressOut={() => {
              actionScale.value = withSpring(1);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>
              {isFinalStep ? t('focus.complete') : t('focus.next')}
            </Text>
            {isFinalStep ? (
              <Check size={18} color="#FFFFFF" strokeWidth={2.7} />
            ) : (
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
            )}
          </AnimatedTouchableOpacity>
        </View>
      </AnimatedView>
    </AnimatedView>
  );
};

const styles = StyleSheet.create({
  screenSection: {
    width: '100%',
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(18, 18, 30, 0.94)',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#A78BFA',
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
  },
  stepBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  stepBadgeText: {
    color: '#C4B5FD',
    fontSize: 16,
    fontWeight: '700',
  },
  headerCopy: {
    flex: 1,
    marginLeft: 12,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  difficulty: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 12,
    marginTop: 3,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 20,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#A78BFA',
  },
  content: {
    paddingTop: 28,
    paddingBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  instruction: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
  },
  stoppingPoint: {
    marginTop: 20,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.22)',
  },
  stoppingPointLabel: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  stoppingPointText: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 14,
    lineHeight: 20,
  },
  timerSection: {
    paddingTop: 18,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  secondaryButton: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 17,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#7C3AED',
  },
  completeButton: {
    backgroundColor: '#059669',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.48,
  },
});
