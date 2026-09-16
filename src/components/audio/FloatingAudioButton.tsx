import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Headphones, Pause, Play, Square, Volume2 } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAudioContext, AUDIO_TRACKS, AudioTrack } from '../../context';
import { SoftGlow } from '../SoftGlow';
import { haptics } from '../../lib/ui/haptics';

const AnimatedView = Animated.createAnimatedComponent(View);

// Screens where no audio control may appear at all
const HIDDEN_ROUTES = ['/panic', '/login'];

const ORB_SIZE = 52;
const IDLE_RING = ['rgba(255, 255, 255, 0.32)', 'rgba(255, 255, 255, 0.03)'] as const;
const ORB_FILL = ['#26263A', '#0D0D16'] as const;

// Staggered timings keep the bars out of lockstep, which would read as mechanical.
const EQUALIZER_BARS = [
  { rest: 6, peak: 16, duration: 460 },
  { rest: 10, peak: 20, duration: 620 },
  { rest: 7, peak: 13, duration: 380 },
];

type EqualizerBarProps = {
  color: string;
  active: boolean;
  rest: number;
  peak: number;
  duration: number;
};

function EqualizerBar({ color, active, rest, peak, duration }: EqualizerBarProps) {
  const height = useSharedValue(rest);

  useEffect(() => {
    if (active) {
      const easing = Easing.inOut(Easing.quad);
      height.value = withRepeat(
        withSequence(
          withTiming(peak, { duration, easing }),
          withTiming(rest * 0.6, { duration, easing })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(height);
      height.value = withTiming(rest, { duration: 250 });
    }
  }, [active, duration, height, peak, rest]);

  const barStyle = useAnimatedStyle(() => ({ height: height.value }));

  return <Animated.View style={[styles.equalizerBar, { backgroundColor: color }, barStyle]} />;
}

// ============================================================================
// FLOATING AUDIO BUTTON — a glass orb with a gradient hairline ring.
// Idle it shows headphones; with a track it becomes a live equalizer.
// Tap opens a bottom sheet with the track list, play/pause and stop.
// ============================================================================

export const FloatingAudioButton: React.FC = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { currentTrack, isPlaying, play, pause, resume, stop } = useAudioContext();
  const [sheetVisible, setSheetVisible] = useState(false);

  // Subtle breathing glow while playing. All hooks stay above any conditional return.
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (isPlaying) {
      pulse.value = withRepeat(
        withTiming(0.55, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 300 });
    }
  }, [isPlaying, pulse]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  if (HIDDEN_ROUTES.includes(pathname)) {
    return null;
  }

  // On the focus step flow the button stays available but recedes.
  const isQuietRoute = pathname === '/focus';

  const hasTrack = !!currentTrack;
  const trackColor = currentTrack?.color || '#8B5CF6';
  const ringColors = hasTrack ? ([trackColor, `${trackColor}26`] as const) : IDLE_RING;
  const barColor = isPlaying ? trackColor : `${trackColor}99`;

  const openSheet = () => {
    haptics.tap();
    setSheetVisible(true);
  };

  const closeSheet = () => setSheetVisible(false);

  const handleTrackPress = async (track: AudioTrack) => {
    haptics.selection();
    if (currentTrack?.id === track.id) {
      if (isPlaying) {
        await pause();
      } else {
        await resume();
      }
    } else {
      await play(track.id);
    }
  };

  const handleStop = async () => {
    haptics.press();
    setSheetVisible(false);
    await stop();
  };

  return (
    <>
      <AnimatedView
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={[styles.orbContainer, { bottom: Math.max(insets.bottom, 16) + 16 }]}
      >
        {/* Opacity lives on an inner view so it never fights the layout animation */}
        <View style={{ opacity: isQuietRoute ? (hasTrack ? 0.6 : 0.45) : 1 }}>
          {hasTrack && (
            <Animated.View style={[StyleSheet.absoluteFill, glowStyle]} pointerEvents="none">
              <SoftGlow color={trackColor} intensity={0.45} spread={18} />
            </Animated.View>
          )}
          <TouchableOpacity
            onPress={openSheet}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('audio.title')}
            style={styles.orbShadow}
          >
            <LinearGradient
              colors={ringColors}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={styles.orbRing}
            >
              <LinearGradient
                colors={ORB_FILL}
                start={{ x: 0.3, y: 0 }}
                end={{ x: 0.7, y: 1 }}
                style={styles.orbFill}
              >
                {hasTrack ? (
                  <View style={styles.equalizer}>
                    {EQUALIZER_BARS.map((bar, index) => (
                      <EqualizerBar key={index} color={barColor} active={isPlaying} {...bar} />
                    ))}
                  </View>
                ) : (
                  <Headphones size={21} color="rgba(255, 255, 255, 0.88)" strokeWidth={1.75} />
                )}
              </LinearGradient>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </AnimatedView>

      {/* Track picker sheet */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.backdrop} onPress={closeSheet}>
          <AnimatedView
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>

        <AnimatedView
          entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(200)}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t('audio.title')}</Text>

          {AUDIO_TRACKS.map((track) => {
            const isActive = currentTrack?.id === track.id;
            return (
              <TouchableOpacity
                key={track.id}
                style={[styles.trackRow, isActive && styles.trackRowActive]}
                onPress={() => handleTrackPress(track)}
                activeOpacity={0.75}
              >
                <View style={[styles.trackIcon, { backgroundColor: `${track.color}20` }]}>
                  <Volume2 size={18} color={track.color} strokeWidth={2} />
                </View>
                <View style={styles.trackInfo}>
                  <Text style={styles.trackName}>{t(`audio.tracks.${track.id}.name`)}</Text>
                  <Text style={styles.trackDesc}>{t(`audio.tracks.${track.id}.description`)}</Text>
                </View>
                {isActive && (
                  <View style={[styles.stateBadge, { backgroundColor: track.color }]}>
                    {isPlaying ? (
                      <Pause size={13} color="#FFFFFF" strokeWidth={2.5} fill="#FFFFFF" />
                    ) : (
                      <Play size={13} color="#FFFFFF" strokeWidth={2.5} fill="#FFFFFF" />
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {hasTrack && (
            <TouchableOpacity style={styles.stopButton} onPress={handleStop} activeOpacity={0.8}>
              <Square size={14} color="#F87171" strokeWidth={2.5} fill="#F87171" />
              <Text style={styles.stopButtonText}>{t('audio.stop')}</Text>
            </TouchableOpacity>
          )}
        </AnimatedView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  orbContainer: {
    position: 'absolute',
    right: 16,
    width: ORB_SIZE,
    height: ORB_SIZE,
    zIndex: 100,
  },
  orbShadow: {
    borderRadius: ORB_SIZE / 2,
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  orbRing: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    padding: 1,
  },
  orbFill: {
    flex: 1,
    borderRadius: ORB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equalizer: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  equalizerBar: {
    width: 3,
    borderRadius: 1.5,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#12121C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  trackRowActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  trackIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  trackDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 1,
  },
  stateBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  stopButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F87171',
  },
});

export default FloatingAudioButton;
