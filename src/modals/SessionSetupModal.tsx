import React, { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
// The gesture-aware ScrollView lets a dial's drag win over the sheet's own scrolling.
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, Music, Target, VolumeX, X } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { AUDIO_TRACKS, useAudioContext } from '../context';
import { DurationWheels } from '../components/time/DurationWheels';
import { haptics } from '../lib/ui/haptics';
import { PRESS_SPRING } from '../lib/ui/motion';

// ============================================================================
// TYPES
// ============================================================================

export interface SessionConfig {
  /** Whole seconds. */
  durationSec: number;
  /** Ambience for the session; `null` is silence. Already playing when the session starts. */
  trackId: string | null;
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

const PRESET_MINUTES = [15, 25, 45, 60];
const DEFAULT_DURATION_SEC = 25 * 60;
const MAX_HOURS = 4;
// Shorter than this is a mis-scroll, not a focus session.
const MIN_SESSION_SEC = 10;

// ============================================================================
// START BUTTON
// ============================================================================

function StartButton({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={buttonStyle}>
      <TouchableOpacity
        onPressIn={() => {
          if (!disabled) scale.value = withSpring(0.96, PRESS_SPRING);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, PRESS_SPRING);
        }}
        onPress={() => {
          if (disabled) return;
          haptics.commit();
          onPress();
        }}
        activeOpacity={1}
        disabled={disabled}
        style={[styles.startButton, disabled && styles.startButtonDisabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
      >
        <LinearGradient
          colors={disabled ? ['#4B5563', '#374151'] : ['#8B5CF6', '#6D28D9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.startButtonGradient}
        >
          <Target size={22} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.startButtonText}>{t('session.start')}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================================================
// SESSION SETUP MODAL
// ============================================================================

export const SessionSetupModal: React.FC<SessionSetupModalProps> = ({
  visible,
  onClose,
  taskTitle,
  onStartSession,
}) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { currentTrack, isPlaying, beginAudioSession, setSessionTrack, endAudioSession } =
    useAudioContext();

  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SEC);
  const [trackId, setTrackId] = useState<string | null>(null);

  // Opening the sheet starts the audio session. The default ambience is whatever is already
  // playing, so a session begun mid-listening simply carries on without a gap.
  useEffect(() => {
    if (!visible) return;
    beginAudioSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the sheet opens with defaults, not with the last session
    setDurationSec(DEFAULT_DURATION_SEC);
    setTrackId(isPlaying ? (currentTrack?.id ?? null) : null);
    // Read once per opening: later changes are the user's own choices in this sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleClose = useCallback(() => {
    haptics.tap();
    // Cancelled before starting: give the home screen its sound back.
    void endAudioSession();
    onClose();
  }, [endAudioSession, onClose]);

  const handleTrackSelect = useCallback(
    (next: string | null) => {
      haptics.selection();
      setTrackId(next);
      void setSessionTrack(next);
    },
    [setSessionTrack]
  );

  const handlePreset = useCallback((minutes: number) => {
    haptics.selection();
    setDurationSec(minutes * 60);
  }, []);

  const handleStart = useCallback(() => {
    // The chosen ambience is already playing; the session keeps it until it ends.
    onStartSession({ durationSec, trackId });
  }, [durationSec, trackId, onStartSession]);

  const isValid = durationSec >= MIN_SESSION_SEC;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* On Android a Modal is its own window, outside the app's gesture root. */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

          <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Animated.View
                entering={FadeInDown.delay(100).springify()}
                style={[styles.card, { maxWidth: Math.min(width - 32, 520) }]}
              >
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerLeft}>
                    <Target size={20} color="#8B5CF6" />
                    <Text style={styles.headerLabel}>{t('session.focusSession')}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.close')}
                  >
                    <X size={24} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.taskTitle} numberOfLines={2}>
                  {taskTitle}
                </Text>

                {/* Duration */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Clock size={18} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.sectionTitle}>{t('session.duration')}</Text>
                  </View>

                  <View style={styles.presetRow}>
                    {PRESET_MINUTES.map((minutes) => {
                      const isActive = durationSec === minutes * 60;
                      return (
                        <TouchableOpacity
                          key={minutes}
                          style={[styles.preset, isActive && styles.presetActive]}
                          onPress={() => handlePreset(minutes)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isActive }}
                        >
                          <Text style={[styles.presetText, isActive && styles.presetTextActive]}>
                            {t('session.durationOption', { count: minutes })}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.wheels}>
                    <DurationWheels
                      value={durationSec}
                      onChange={setDurationSec}
                      maxHours={MAX_HOURS}
                    />
                  </View>
                  {!isValid ? <Text style={styles.hint}>{t('session.minDuration')}</Text> : null}
                </View>

                {/* Ambience */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Music size={18} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.sectionTitle}>{t('session.ambience')}</Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.trackRow}
                  >
                    <TrackChip
                      label={t('session.mute')}
                      active={trackId === null}
                      onPress={() => handleTrackSelect(null)}
                      icon={<VolumeX size={16} color="rgba(255,255,255,0.8)" />}
                    />
                    {AUDIO_TRACKS.map((track) => (
                      <TrackChip
                        key={track.id}
                        label={t(`audio.tracks.${track.id}.name`)}
                        active={trackId === track.id}
                        onPress={() => handleTrackSelect(track.id)}
                        icon={<View style={[styles.trackDot, { backgroundColor: track.color }]} />}
                        accent={track.color}
                      />
                    ))}
                  </ScrollView>
                </View>

                <StartButton onPress={handleStart} disabled={!isValid} />
              </Animated.View>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

type TrackChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  accent?: string;
};

function TrackChip({ label, active, onPress, icon, accent = '#8B5CF6' }: TrackChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.trackChip, active && { borderColor: accent, backgroundColor: `${accent}26` }]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {icon}
      <Text style={[styles.trackText, active && styles.trackTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: 'rgba(30, 30, 46, 0.98)',
    borderRadius: 28,
    padding: 20,
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
  taskTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 24,
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
  presetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  preset: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  presetActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  presetText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  presetTextActive: {
    color: '#C4B5FD',
  },
  wheels: {
    marginTop: 16,
    alignItems: 'center',
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: '#FCA5A5',
    textAlign: 'center',
  },
  trackRow: {
    gap: 8,
    paddingRight: 4,
  },
  trackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  trackDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  trackText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    maxWidth: 160,
  },
  trackTextActive: {
    color: '#FFFFFF',
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
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});

export default SessionSetupModal;
