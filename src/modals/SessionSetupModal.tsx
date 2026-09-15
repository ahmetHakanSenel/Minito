import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Clock, VolumeX, CloudRain, Music, Waves, Target } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { useTranslation } from 'react-i18next';

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// ============================================================================
// TYPES
// ============================================================================

export type SoundType = 'mute' | 'brown-noise' | 'rain' | 'lo-fi';

export interface SessionConfig {
  duration: number; // in minutes
  sound: SoundType;
}

export interface SessionSetupModalProps {
  visible: boolean;
  onClose: () => void;
  taskTitle: string;
  onStartSession: (config: SessionConfig) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DURATION_OPTIONS = [{ value: 15 }, { value: 25 }, { value: 45 }, { value: 60 }];

const SOUND_OPTIONS: { id: SoundType; labelKey: string; icon: React.ReactNode }[] = [
  { id: 'mute', labelKey: 'session.mute', icon: <VolumeX size={24} color="#FFFFFF" /> },
  { id: 'brown-noise', labelKey: 'session.brownNoise', icon: <Waves size={24} color="#FFFFFF" /> },
  { id: 'rain', labelKey: 'session.rain', icon: <CloudRain size={24} color="#FFFFFF" /> },
  { id: 'lo-fi', labelKey: 'session.lofi', icon: <Music size={24} color="#FFFFFF" /> },
];

// Button component - simple tap to start (no hold required)

// ============================================================================
// START BUTTON COMPONENT (Single tap to start)
// ============================================================================

interface StartButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

const StartButton: React.FC<StartButtonProps> = ({ onPress, disabled }) => {
  const { t } = useTranslation();
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  }, [disabled]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, []);

  const handlePress = useCallback(() => {
    if (disabled) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onPress();
  }, [disabled, onPress]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.startButtonContainer, buttonStyle]}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        activeOpacity={1}
        disabled={disabled}
        style={[styles.startButton, disabled && styles.startButtonDisabled]}
      >
        <LinearGradient
          colors={disabled ? ['#4B5563', '#374151'] : ['#8B5CF6', '#6D28D9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.startButtonGradient}
        >
          <View style={styles.startButtonContent}>
            <Target size={22} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.startButtonText}>{t('session.start')}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================================
// SESSION SETUP MODAL COMPONENT
// ============================================================================

export const SessionSetupModal: React.FC<SessionSetupModalProps> = ({
  visible,
  onClose,
  taskTitle,
  onStartSession,
}) => {
  const { t } = useTranslation();
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDuration, setCustomDuration] = useState('');
  const [selectedSound, setSelectedSound] = useState<SoundType>('mute');
  const soundRef = useRef<Audio.Sound | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedDuration(25);
      setIsCustomDuration(false);
      setCustomDuration('');
      setSelectedSound('mute');
    } else {
      stopPreviewSound();
    }
  }, [visible]);

  // ========================================================================
  // SOUND PREVIEW
  // ========================================================================

  const stopPreviewSound = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (error) {
        // Ignore errors during cleanup
      }
      soundRef.current = null;
    }
  }, []);

  const playPreviewSound = useCallback(
    async (type: SoundType) => {
      await stopPreviewSound();

      if (type === 'mute') return;

      // TODO: Add audio files to assets/sounds/
      // For now, just log and provide haptic feedback
      console.log(`[SessionSetup] Sound preview: ${type}`);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [stopPreviewSound]
  );

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const handleClose = useCallback(() => {
    stopPreviewSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose, stopPreviewSound]);

  const handleDurationSelect = useCallback((duration: number) => {
    setSelectedDuration(duration);
    setIsCustomDuration(false);
    Haptics.selectionAsync();
  }, []);

  const handleCustomDurationToggle = useCallback(() => {
    setIsCustomDuration(true);
    Haptics.selectionAsync();
  }, []);

  const handleCustomDurationChange = useCallback((text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setCustomDuration(numericValue);
    if (numericValue) {
      setSelectedDuration(parseInt(numericValue, 10));
    }
  }, []);

  const handleSoundSelect = useCallback(
    (sound: SoundType) => {
      setSelectedSound(sound);
      playPreviewSound(sound);
    },
    [playPreviewSound]
  );

  const handleStartSession = useCallback(() => {
    stopPreviewSound();
    onStartSession({
      duration: selectedDuration,
      sound: selectedSound,
    });
  }, [selectedDuration, selectedSound, onStartSession, stopPreviewSound]);

  const isValidDuration = selectedDuration > 0 && selectedDuration <= 180;

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <AnimatedView entering={FadeIn.duration(200)} style={styles.overlay}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.container}>
            <AnimatedView entering={FadeInDown.delay(100).springify()} style={styles.card}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Target size={20} color="#8B5CF6" />
                  <Text style={styles.headerLabel}>{t('session.focusSession')}</Text>
                </View>
                <TouchableOpacity
                  onPress={handleClose}
                  style={styles.closeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={24} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>

              {/* Task Title */}
              <Text style={styles.taskTitle} numberOfLines={2}>
                {taskTitle}
              </Text>

              {/* Section A: Duration */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Clock size={18} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.sectionTitle}>{t('session.duration')}</Text>
                </View>

                <View style={styles.durationGrid}>
                  {DURATION_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.durationOption,
                        selectedDuration === option.value &&
                          !isCustomDuration &&
                          styles.durationOptionActive,
                      ]}
                      onPress={() => handleDurationSelect(option.value)}
                    >
                      <Text
                        style={[
                          styles.durationText,
                          selectedDuration === option.value &&
                            !isCustomDuration &&
                            styles.durationTextActive,
                        ]}
                      >
                        {t('session.durationOption', { count: option.value })}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Custom Duration */}
                <TouchableOpacity
                  style={[
                    styles.customDurationButton,
                    isCustomDuration && styles.customDurationButtonActive,
                  ]}
                  onPress={handleCustomDurationToggle}
                >
                  {isCustomDuration ? (
                    <View style={styles.customInputRow}>
                      <TextInput
                        style={styles.customInput}
                        value={customDuration}
                        onChangeText={handleCustomDurationChange}
                        placeholder="30"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        keyboardType="number-pad"
                        maxLength={3}
                        autoFocus
                      />
                      <Text style={styles.customInputSuffix}>{t('session.minutes')}</Text>
                    </View>
                  ) : (
                    <Text style={styles.customDurationText}>{t('session.customDuration')}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Section B: Ambience */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Music size={18} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.sectionTitle}>{t('session.ambience')}</Text>
                </View>

                <View style={styles.soundGrid}>
                  {SOUND_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.soundOption,
                        selectedSound === option.id && styles.soundOptionActive,
                      ]}
                      onPress={() => handleSoundSelect(option.id)}
                    >
                      <View
                        style={[
                          styles.soundIconContainer,
                          selectedSound === option.id && styles.soundIconContainerActive,
                        ]}
                      >
                        {option.icon}
                      </View>
                      <Text
                        style={[
                          styles.soundLabel,
                          selectedSound === option.id && styles.soundLabelActive,
                        ]}
                      >
                        {t(option.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Section C: Action */}
              <View style={styles.actionSection}>
                <StartButton onPress={handleStartSession} disabled={!isValidDuration} />
              </View>
            </AnimatedView>
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: 'rgba(30, 30, 46, 0.98)',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.2,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B5CF6',
    letterSpacing: 1,
  },
  closeButton: {
    padding: 4,
  },
  taskTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 28,
    lineHeight: 28,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1,
  },
  durationGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  durationOption: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  durationOptionActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  durationText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  durationTextActive: {
    color: '#8B5CF6',
  },
  customDurationButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderStyle: 'dashed',
  },
  customDurationButtonActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.4)',
    borderStyle: 'solid',
  },
  customDurationText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  customInput: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    minWidth: 50,
  },
  customInputSuffix: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  soundGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  soundOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  soundOptionActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  soundIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  soundIconContainerActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
  },
  soundLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  soundLabelActive: {
    color: '#A78BFA',
  },
  actionSection: {
    marginTop: 8,
  },
  startButtonContainer: {
    alignItems: 'center',
  },
  startButton: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  startButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  startButtonGradient: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});

export default SessionSetupModal;
