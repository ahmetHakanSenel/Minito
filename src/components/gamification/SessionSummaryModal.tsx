import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PartyPopper, Clock, Flame, ArrowRight, Check } from 'lucide-react-native';
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
import { ConfettiAnimation } from '../ConfettiAnimation';
import { StreakFlame } from '../gamification';

const { width } = Dimensions.get('window');
const AnimatedView = Animated.createAnimatedComponent(View);

interface SessionSummaryModalProps {
  visible: boolean;
  onClose: () => void;
  sessionDuration: number; // in minutes
  todayTotalDuration: number; // in minutes
  streakDays: number;
  stepsCompleted: number;
}

export const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({
  visible,
  onClose,
  sessionDuration,
  todayTotalDuration,
  streakDays,
  stepsCompleted,
}) => {
  const [showConfetti, setShowConfetti] = React.useState(false);
  const buttonScale = useSharedValue(1);
  const celebrationScale = useSharedValue(0.5);

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

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const celebrationStyle = useAnimatedStyle(() => ({
    transform: [{ scale: celebrationScale.value }],
  }));

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} dakika`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} saat ${mins} dakika` : `${hours} saat`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
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
                <PartyPopper size={48} color="#FFFFFF" strokeWidth={2} />
              </LinearGradient>
            </AnimatedView>

            {/* Title */}
            <AnimatedView entering={FadeInDown.delay(200).springify()}>
              <Text style={styles.title}>Harika!</Text>
              <Text style={styles.subtitle}>{sessionDuration} dakika odaklandın</Text>
            </AnimatedView>

            {/* Stats Cards */}
            <AnimatedView
              entering={FadeInDown.delay(300).springify()}
              style={styles.statsContainer}
            >
              {/* Today's Total */}
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Clock size={24} color="#60A5FA" strokeWidth={2} />
                </View>
                <Text style={styles.statLabel}>Bugün Toplam</Text>
                <Text style={styles.statValue}>{formatDuration(todayTotalDuration)}</Text>
              </View>

              {/* Streak */}
              <View style={styles.statCard}>
                <StreakFlame streakDays={streakDays} isActive={streakDays > 0} size="medium" />
                <Text style={styles.statLabel}>Seri</Text>
                <Text style={styles.statValue}>{streakDays} gün</Text>
              </View>
            </AnimatedView>

            {/* Steps completed */}
            <AnimatedView entering={FadeInDown.delay(400).springify()} style={styles.stepsInfo}>
              <Check size={16} color="#34D399" strokeWidth={2.5} />
              <Text style={styles.stepsText}>{stepsCompleted} adım tamamlandı</Text>
            </AnimatedView>

            {/* Action Button */}
            <AnimatedView
              entering={FadeInDown.delay(500).springify()}
              style={styles.buttonContainer}
            >
              <Animated.View style={buttonStyle}>
                <TouchableOpacity
                  onPress={handleClose}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  activeOpacity={1}
                >
                  <LinearGradient
                    colors={['#8B5CF6', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.button}
                  >
                    <Text style={styles.buttonText}>Ana Ekrana Dön</Text>
                    <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.5} />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </AnimatedView>
          </View>
        </SafeAreaView>
      </AnimatedView>
    </Modal>
  );
};

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
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 32,
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
    marginTop: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 32,
  },
  stepsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34D399',
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
