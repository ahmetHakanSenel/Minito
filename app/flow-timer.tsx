import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

// NOTE: Audio integration will be enabled later.
// The hook is wired but commented out to avoid asset requirements during dev.
// import { useAmbientAudio } from '../src/lib/audio/ambientAudio';

const AnimatedView = Animated.createAnimatedComponent(View);

type FlowTimerParams = {
  input: string;
  minutes?: string;
  seconds?: string;
};

export default function FlowTimerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<FlowTimerParams>();

  const initialMinutes = Number(params.minutes ?? '25') || 25;
  const initialSeconds = Number(params.seconds ?? '0') || 0;

  const [minutes, setMinutes] = useState(initialMinutes);
  const [seconds, setSeconds] = useState(initialSeconds);
  const [remaining, setRemaining] = useState(initialMinutes * 60 + initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompletionLoop, setIsCompletionLoop] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const completionHapticRef = useRef<NodeJS.Timeout | null>(null);
  const completionTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // const { startAmbience, stopAmbience } = useAmbientAudio();

  // Animations: input card slide up, timer fade in
  const inputTranslateY = useSharedValue(40);
  const timerOpacity = useSharedValue(0);

  // Completion pulse over the Aurora background
  const pulseOpacity = useSharedValue(0);
  // Border pulse animation for completion state
  const borderPulseOpacity = useSharedValue(1);

  useEffect(() => {
    inputTranslateY.value = withSpring(0, {
      damping: 14,
      stiffness: 120,
    });
    timerOpacity.value = withSpring(1, {
      damping: 18,
      stiffness: 120,
    });
  }, []);

  // Cleanup timer and completion loop on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (completionHapticRef.current) {
        clearInterval(completionHapticRef.current);
      }
      completionTimeoutsRef.current.forEach((id) => clearTimeout(id));
    };
  }, []);

  const inputCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: inputTranslateY.value }],
  }));

  const timerCardStyle = useAnimatedStyle(() => ({
    opacity: timerOpacity.value,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  // Animated border style for completion state (purple neon with pulse)
  const borderPulseStyle = useAnimatedStyle(() => {
    const opacity = borderPulseOpacity.value;
    return {
      borderColor: `rgba(168, 85, 247, ${opacity})`, // #A855F7 with animated opacity
      shadowColor: '#A855F7',
      shadowOpacity: opacity * 0.5,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0 },
      elevation: opacity > 0.5 ? 8 : 0,
    };
  });

  const totalFromState = (m: number, s: number) => Math.max(0, m * 60 + s);

  // Adjust minutes part (affects total time) based on remaining seconds
  const adjustMinutes = (delta: number) => {
    setRemaining((prev) => {
      const nextTotal = Math.max(0, prev + delta * 60);
      const m = Math.floor(nextTotal / 60);
      const s = nextTotal % 60;
      setMinutes(m);
      setSeconds(s);
      return nextTotal;
    });
  };

  // Adjust seconds part with normalization into minutes when needed
  const adjustSeconds = (delta: number) => {
    setRemaining((prev) => {
      const nextTotal = Math.max(0, prev + delta);
      const m = Math.floor(nextTotal / 60);
      const s = nextTotal % 60;
      setMinutes(m);
      setSeconds(s);
      return nextTotal;
    });
  };

  const handleStart = () => {
    if (isCompletionLoop) return; // wait for user to acknowledge
    if (isRunning) return;
    if (remaining <= 0) {
      const freshTotal = totalFromState(minutes, seconds);
      setRemaining(freshTotal);
      if (freshTotal <= 0) return;
    }

    setIsRunning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // startAmbience().catch(console.warn); // Enable when audio assets are added

    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handlePause = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
    setIsCompletionLoop(false);
    Haptics.selectionAsync();
    // stopAmbience().catch(console.warn); // Enable when audio assets are added
  };

  const handleReset = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
    setIsCompletionLoop(false);
    // Stop visual and border pulse animations
    cancelAnimation(pulseOpacity);
    pulseOpacity.value = 0;
    cancelAnimation(borderPulseOpacity);
    borderPulseOpacity.value = 1;
    setMinutes(initialMinutes);
    setSeconds(initialSeconds);
    setRemaining(initialMinutes * 60 + initialSeconds);
  };

  // Triple haptic burst (Heavy x3)
  const tripleHapticBurst = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    completionTimeoutsRef.current.push(
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200),
    );
    completionTimeoutsRef.current.push(
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400),
    );
  };

  const handleComplete = async () => {
    setIsRunning(false);
    setIsCompletionLoop(true);
    // await stopAmbience().catch(console.warn); // Enable when audio assets are added

    // Clear any previous timeouts
    completionTimeoutsRef.current.forEach((id) => clearTimeout(id));
    completionTimeoutsRef.current = [];

    // Strong triple haptic burst on completion
    tripleHapticBurst();

    // Visual pulse over Aurora: continuous gentle breathing until user stops
    pulseOpacity.value = withRepeat(
      withTiming(0.55, {
        duration: 1400,
        easing: Easing.inOut(Easing.sin),
      }),
      -1, // infinite
      true, // reverse (breathing effect)
    );

    // Border pulse animation: gentle breathing effect on card borders
    borderPulseOpacity.value = withRepeat(
      withTiming(0.4, {
        duration: 1200,
        easing: Easing.inOut(Easing.sin),
      }),
      -1, // infinite
      true, // reverse (breathing effect)
    );

    // Repeating triple haptic every few seconds until user acknowledges
    if (completionHapticRef.current) {
      clearInterval(completionHapticRef.current);
    }
    completionHapticRef.current = setInterval(() => {
      tripleHapticBurst();
    }, 4000);

    // TODO: Play soft ambient chime / deep single-note gong here
    // Once audio asset is added:
    // 1. Import a short chime sound
    // 2. Trigger it here with a gentle volume
  };

  const handleAcknowledgeComplete = () => {
    setIsCompletionLoop(false);
    // Stop visual pulse and reset background to base
    cancelAnimation(pulseOpacity);
    pulseOpacity.value = withTiming(0, {
      duration: 500,
      easing: Easing.inOut(Easing.sin),
    });
    // Stop border pulse animation and reset to normal
    cancelAnimation(borderPulseOpacity);
    borderPulseOpacity.value = 1;
    // Stop repeating haptic
    if (completionHapticRef.current) {
      clearInterval(completionHapticRef.current);
      completionHapticRef.current = null;
    }
    // Clear pending haptic timeouts
    completionTimeoutsRef.current.forEach((id) => clearTimeout(id));
    completionTimeoutsRef.current = [];
  };

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    const mm = m.toString().padStart(2, '0');
    const ss = s.toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const handleBack = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
    setIsCompletionLoop(false);
    // Stop border pulse animation
    cancelAnimation(borderPulseOpacity);
    borderPulseOpacity.value = 1;
    if (completionHapticRef.current) {
      clearInterval(completionHapticRef.current);
      completionHapticRef.current = null;
    }
    router.back();
  };

  const isAtZero = remaining <= 0;
  const currentMinutes = Math.floor(remaining / 60);
  const currentSeconds = remaining % 60;
  const mm = currentMinutes.toString().padStart(2, '0');
  const ss = currentSeconds.toString().padStart(2, '0');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Completion pulse overlay (simulates brighter Aurora) */}
      <AnimatedView pointerEvents="none" style={[styles.pulseOverlay, pulseStyle]} />

      <View style={styles.container}>
        {/* Input card that slides up */}
        <AnimatedView
          style={[
            styles.inputCard,
            !isCompletionLoop && styles.cardReset,
            isCompletionLoop && borderPulseStyle,
            inputCardStyle,
          ]}
        >
          <Text style={styles.inputLabel}>Akış Oturumu</Text>
          <Text style={styles.inputText}>{params.input || 'Süreye bağlı odak bloğu'}</Text>
        </AnimatedView>

        {/* Timer card that fades in beneath input */}
        <AnimatedView
          style={[
            styles.timerCard,
            !isCompletionLoop && styles.cardReset,
            isCompletionLoop && borderPulseStyle,
            timerCardStyle,
          ]}
        >
          <Text style={styles.timerLabel}>Süre</Text>

          {/* Before start: per-part +/- controls. While running/completed: single big countdown */}
          {!isRunning && !isCompletionLoop ? (
            <View style={styles.timeColumnsRow}>
              {/* Minutes column */}
              <View style={styles.timeColumn}>
                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => adjustMinutes(1)}
                  disabled={isRunning}
                >
                  <Text style={styles.adjustButtonText}>+</Text>
                </TouchableOpacity>

                <Text style={styles.timeValue}>{mm}</Text>

                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => adjustMinutes(-1)}
                  disabled={isRunning}
                >
                  <Text style={styles.adjustButtonText}>-</Text>
                </TouchableOpacity>
              </View>

              {/* Colon separator */}
              <Text style={styles.timeColon}>:</Text>

              {/* Seconds column */}
              <View style={styles.timeColumn}>
                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => adjustSeconds(5)}
                  disabled={isRunning}
                >
                  <Text style={styles.adjustButtonText}>+</Text>
                </TouchableOpacity>

                <Text style={styles.timeValue}>{ss}</Text>

                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => adjustSeconds(-5)}
                  disabled={isRunning}
                >
                  <Text style={styles.adjustButtonText}>-</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.runningTimeWrapper}>
              <Text style={styles.runningTimeText}>{formatTime(remaining)}</Text>
            </View>
          )}

          {/* Ghost secondary actions */}
          <View style={styles.ghostRow}>
            <TouchableOpacity style={styles.ghostButton} onPress={handleBack}>
              <Text style={styles.ghostButtonText}>Vazgeç</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.ghostButton} onPress={handleReset}>
              <Text style={styles.ghostButtonText}>Sıfırla</Text>
            </TouchableOpacity>
          </View>

          {/* Hero Start button */}
          <TouchableOpacity
            style={[
              styles.heroButton,
              !isCompletionLoop && isAtZero && !isRunning && { opacity: 0.4 },
            ]}
            onPress={
              isCompletionLoop
                ? handleAcknowledgeComplete
                : isRunning
                ? handlePause
                : handleStart
            }
            disabled={!isCompletionLoop && isAtZero && !isRunning}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#A855F7', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroGradient}
            >
              <Text style={styles.heroButtonText}>
                {isCompletionLoop
                  ? 'Bitti, durdur'
                  : isRunning
                  ? 'Duraklat'
                  : isAtZero
                  ? 'Süreyi ayarla'
                  : 'Başla'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Placeholder for future focus soundscape selector */}
          {/* 
          <View style={styles.soundscapeRow}>
            <Text style={styles.soundscapeLabel}>Focus Soundscape</Text>
            <View style={styles.soundscapeChipsRow}>
              <SoundChip label="Brown Noise" />
              <SoundChip label="Binaural" />
              <SoundChip label="Ambient" />
            </View>
          </View>
          */}
        </AnimatedView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 32,
    justifyContent: 'flex-start',
  },
  pulseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(139, 92, 246, 0.35)',
    zIndex: 1,
  },
  inputCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 2,
  },
  // Ensures we always get back to the base subtle border/shadow
  cardReset: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowOpacity: 0,
    elevation: 0,
  },
  inputLabel: {
    color: '#A1A1AA',
    fontSize: 13,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputText: {
    color: '#E5E5E5',
    fontSize: 18,
    lineHeight: 26,
  },
  timerCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 2,
  },
  timerLabel: {
    color: '#A1A1AA',
    fontSize: 13,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  timeColumnsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  timeColumn: {
    alignItems: 'center',
  },
  timeValue: {
    color: '#E5E5E5',
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginVertical: 8,
    minWidth: 80,
  },
  timeColon: {
    color: '#E5E5E5',
    fontSize: 48,
    fontWeight: '700',
    marginHorizontal: 2,
    opacity: 0.8,
  },
  runningTimeWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  runningTimeText: {
    color: '#E5E5E5',
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: 4,
  },
  // Minimalist circular +/- buttons
  adjustButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustButtonDisabled: {
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  adjustButtonText: {
    color: '#E5E5E5',
    fontSize: 20,
    fontWeight: '500',
  },
  adjustButtonTextDisabled: {
    color: 'rgba(229, 229, 229, 0.3)',
  },
  // Ghost secondary buttons row
  ghostRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    marginBottom: 20,
  },
  ghostButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  ghostButtonText: {
    color: '#A1A1AA',
    fontSize: 15,
    fontWeight: '500',
  },
  // Hero Start button with gradient
  heroButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  heroGradient: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  /*
  soundscapeRow: {
    marginTop: 20,
  },
  soundscapeLabel: {
    color: '#A1A1AA',
    fontSize: 13,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  soundscapeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  */
});

// Placeholder for future soundscape chip component
// const SoundChip: React.FC<{ label: string }> = ({ label }) => {
//   return (
//     <View
//       style={{
//         paddingHorizontal: 12,
//         paddingVertical: 6,
//         borderRadius: 999,
//         borderWidth: 1,
//         borderColor: '#2A2A2A',
//         backgroundColor: '#121212',
//       }}
//     >
//       <Text
//         style={{
//           color: '#E5E5E5',
//           fontSize: 13,
//         }}
//       >
//         {label}
//       </Text>
//     </View>
//   );
// };


