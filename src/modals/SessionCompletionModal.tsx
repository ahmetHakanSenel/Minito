import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CheckCircle2,
  Clock,
  Smartphone,
  Trophy,
  ArrowRight,
  Target,
  ThumbsUp,
  Flame,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ConfettiAnimation } from '../components/ConfettiAnimation';
import { useTranslation } from 'react-i18next';
import { splitDuration } from '../lib/time/duration';

const { width } = Dimensions.get('window');
const AnimatedView = Animated.createAnimatedComponent(View);

// ============================================================================
// TYPES
// ============================================================================

export interface SessionCompletionModalProps {
  visible: boolean;
  onClose: () => void;
  sessionDuration: number; // in seconds
  pickupCount: number;
  taskTitle: string;
  onTaskCompleted: () => void; // Marks task as done
  onJustSession: () => void; // Keeps the task open
}

// ============================================================================
// SESSION COMPLETION MODAL
// ============================================================================

export const SessionCompletionModal: React.FC<SessionCompletionModalProps> = ({
  visible,
  onClose,
  sessionDuration,
  pickupCount,
  taskTitle,
  onTaskCompleted,
  onJustSession,
}) => {
  const { t } = useTranslation();
  const [showConfetti, setShowConfetti] = React.useState(false);
  const celebrationScale = useSharedValue(0.5);
  const buttonAScale = useSharedValue(1);
  const buttonBScale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      setShowConfetti(true);
      celebrationScale.value = withSequence(
        withTiming(1.2, { duration: 300, easing: Easing.out(Easing.back(2)) }),
        withSpring(1, { damping: 10, stiffness: 100 })
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setShowConfetti(false);
      celebrationScale.value = 0.5;
    }
  }, [visible]);

  const handleTaskCompleted = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onTaskCompleted();
    onClose();
  };

  const handleJustSession = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onJustSession();
    onClose();
  };

  const handlePressInA = () => {
    buttonAScale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOutA = () => {
    buttonAScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePressInB = () => {
    buttonBScale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOutB = () => {
    buttonBScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const celebrationStyle = useAnimatedStyle(() => ({
    transform: [{ scale: celebrationScale.value }],
  }));

  const buttonAStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonAScale.value }],
  }));

  const buttonBStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonBScale.value }],
  }));

  // Sessions can be set to the second, so a 30-second one must not read as "1 minute".
  const formatDuration = (totalSeconds: number) => {
    const { hours, minutes, seconds } = splitDuration(totalSeconds);
    if (hours > 0) {
      return minutes > 0
        ? t('duration.hoursMinutes', { hours, minutes })
        : t('duration.hours', { count: hours });
    }
    if (minutes > 0) {
      return seconds > 0
        ? t('duration.minutesSeconds', { minutes, seconds })
        : t('duration.minutes', { count: minutes });
    }
    return t('duration.seconds', { count: seconds });
  };

  // Calculate focus score (less pickups = better)
  const focusScore = Math.max(0, 100 - pickupCount * 10);
  const FocusIcon = focusScore >= 80 ? Target : focusScore >= 50 ? ThumbsUp : Flame;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <AnimatedView entering={FadeIn.duration(200)} style={styles.overlay}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />

        {/* Confetti */}
        <ConfettiAnimation visible={showConfetti} onComplete={() => {}} />

        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.content}>
            {/* Celebration Icon */}
            <AnimatedView
              entering={FadeInDown.delay(100).springify()}
              style={[styles.iconContainer, celebrationStyle]}
            >
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED', '#6D28D9']}
                style={styles.iconGradient}
              >
                <Trophy size={48} color="#FFFFFF" strokeWidth={2} />
              </LinearGradient>
            </AnimatedView>

            {/* Title */}
            <AnimatedView entering={FadeInDown.delay(200).springify()}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{t('sessionComplete.title')}</Text>
                <FocusIcon size={22} color="#C4B5FD" strokeWidth={2} />
              </View>
              <Text style={styles.subtitle} numberOfLines={2}>
                {t('sessionComplete.subtitle', {
                  task: taskTitle,
                  duration: formatDuration(sessionDuration),
                })}
              </Text>
            </AnimatedView>

            {/* Stats Cards */}
            <AnimatedView
              entering={FadeInDown.delay(300).springify()}
              style={styles.statsContainer}
            >
              {/* Duration */}
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Clock size={24} color="#60A5FA" strokeWidth={2} />
                </View>
                <Text style={styles.statLabel}>{t('sessionComplete.duration')}</Text>
                <Text style={styles.statValue}>{formatDuration(sessionDuration)}</Text>
              </View>

              {/* Pickup Count */}
              <View style={styles.statCard}>
                <View
                  style={[styles.statIconContainer, { backgroundColor: 'rgba(251, 191, 36, 0.2)' }]}
                >
                  <Smartphone size={24} color="#FBBF24" strokeWidth={2} />
                </View>
                <Text style={styles.statLabel}>{t('sessionComplete.pickups')}</Text>
                <Text style={styles.statValue}>
                  {t('sessionComplete.pickupCount', { count: pickupCount })}
                </Text>
              </View>
            </AnimatedView>

            {/* Focus Score */}
            <AnimatedView
              entering={FadeInDown.delay(400).springify()}
              style={styles.focusScoreContainer}
            >
              <Text style={styles.focusScoreLabel}>{t('sessionComplete.focusScore')}</Text>
              <Text style={styles.focusScoreValue}>{focusScore}</Text>
            </AnimatedView>

            {/* Action Buttons */}
            <AnimatedView
              entering={FadeInDown.delay(500).springify()}
              style={styles.buttonsContainer}
            >
              {/* Button A: Task Completed */}
              <Animated.View style={[styles.buttonWrapper, buttonAStyle]}>
                <TouchableOpacity
                  onPress={handleTaskCompleted}
                  onPressIn={handlePressInA}
                  onPressOut={handlePressOutA}
                  activeOpacity={1}
                >
                  <LinearGradient
                    colors={['#34D399', '#10B981']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.buttonPrimary}
                  >
                    <CheckCircle2 size={22} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={styles.buttonPrimaryText}>{t('sessionComplete.taskDone')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {/* Button B: Just a Session */}
              <Animated.View style={[styles.buttonWrapper, buttonBStyle]}>
                <TouchableOpacity
                  onPress={handleJustSession}
                  onPressIn={handlePressInB}
                  onPressOut={handlePressOutB}
                  activeOpacity={1}
                  style={styles.buttonSecondary}
                >
                  <Text style={styles.buttonSecondaryText}>{t('sessionComplete.justSession')}</Text>
                  <ArrowRight size={18} color="rgba(255,255,255,0.7)" strokeWidth={2} />
                </TouchableOpacity>
              </Animated.View>
            </AnimatedView>

            {/* Helper Text */}
            <Text style={styles.helperText}>{t('sessionComplete.helper')}</Text>
          </View>
        </SafeAreaView>
      </AnimatedView>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  focusScoreContainer: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    alignItems: 'center',
  },
  focusScoreLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 4,
  },
  focusScoreValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#8B5CF6',
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  buttonWrapper: {
    width: '100%',
  },
  buttonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#34D399',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  buttonPrimaryText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  buttonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  helperText: {
    marginTop: 20,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default SessionCompletionModal;
