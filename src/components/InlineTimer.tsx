import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withRepeat,
    cancelAnimation,
    Easing,
    FadeInDown,
    FadeOutDown,
} from 'react-native-reanimated';
import { Play, Pause, RotateCcw, Clock, Square } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface InlineTimerProps {
    initialMinutes: number;
    initialSeconds: number;
    onComplete?: () => void;
    onCompletionStateChange?: (isInCompletionLoop: boolean) => void;
}

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const InlineTimer: React.FC<InlineTimerProps> = ({
    initialMinutes,
    initialSeconds,
    onComplete,
    onCompletionStateChange,
}) => {
    const { t } = useTranslation();
    const [remaining, setRemaining] = useState(initialMinutes * 60 + initialSeconds);
    const [isRunning, setIsRunning] = useState(false);
    const [isCompletionLoop, setIsCompletionLoop] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const completionHapticRef = useRef<NodeJS.Timeout | null>(null);
    const completionTimeoutsRef = useRef<NodeJS.Timeout[]>([]);

    // Animations
    const buttonScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(0);
    const borderPulseOpacity = useSharedValue(1);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (completionHapticRef.current) clearInterval(completionHapticRef.current);
            completionTimeoutsRef.current.forEach((id) => clearTimeout(id));
        };
    }, []);

    // Reset when initial values change
    useEffect(() => {
        setRemaining(initialMinutes * 60 + initialSeconds);
        setIsRunning(false);
        setIsCompletionLoop(false);
        // Reset animations
        cancelAnimation(pulseOpacity);
        cancelAnimation(borderPulseOpacity);
        pulseOpacity.value = 0;
        borderPulseOpacity.value = 1;
    }, [initialMinutes, initialSeconds]);

    // Triple haptic burst (like flow-timer)
    const tripleHapticBurst = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        completionTimeoutsRef.current.push(
            setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200),
        );
        completionTimeoutsRef.current.push(
            setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400),
        );
    };

    const handleStart = () => {
        if (isCompletionLoop) return;

        if (remaining <= 0) {
            // Reset and start
            setRemaining(initialMinutes * 60 + initialSeconds);
        }

        if (remaining <= 0 && initialMinutes * 60 + initialSeconds <= 0) return;

        setIsRunning(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
        Haptics.selectionAsync();
    };

    const handleReset = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setIsRunning(false);
        setIsCompletionLoop(false);
        // Stop animations
        cancelAnimation(pulseOpacity);
        cancelAnimation(borderPulseOpacity);
        pulseOpacity.value = 0;
        borderPulseOpacity.value = 1;
        // Stop haptic loop
        if (completionHapticRef.current) {
            clearInterval(completionHapticRef.current);
            completionHapticRef.current = null;
        }
        completionTimeoutsRef.current.forEach((id) => clearTimeout(id));
        completionTimeoutsRef.current = [];
        // Reset time
        setRemaining(initialMinutes * 60 + initialSeconds);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleComplete = () => {
        setIsRunning(false);
        setIsCompletionLoop(true);

        // Notify parent about completion state
        onCompletionStateChange?.(true);

        // Clear any previous timeouts
        completionTimeoutsRef.current.forEach((id) => clearTimeout(id));
        completionTimeoutsRef.current = [];

        // Strong triple haptic burst on completion
        tripleHapticBurst();

        // Pulse animation on container background
        pulseOpacity.value = withRepeat(
            withTiming(0.6, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
            -1,
            true,
        );

        // Border pulse animation
        borderPulseOpacity.value = withRepeat(
            withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
            -1,
            true,
        );

        // Repeating triple haptic every 3 seconds until user stops
        if (completionHapticRef.current) clearInterval(completionHapticRef.current);
        completionHapticRef.current = setInterval(() => {
            tripleHapticBurst();
        }, 3000);

        // TODO: Play completion sound here when audio is added
    };

    const handleStop = () => {
        setIsCompletionLoop(false);

        // Notify parent about completion state
        onCompletionStateChange?.(false);

        // Stop animations
        cancelAnimation(pulseOpacity);
        pulseOpacity.value = withTiming(0, { duration: 300, easing: Easing.inOut(Easing.sin) });
        cancelAnimation(borderPulseOpacity);
        borderPulseOpacity.value = 1;

        // Stop haptic loop
        if (completionHapticRef.current) {
            clearInterval(completionHapticRef.current);
            completionHapticRef.current = null;
        }
        completionTimeoutsRef.current.forEach((id) => clearTimeout(id));
        completionTimeoutsRef.current = [];

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onComplete?.();
    };

    // Adjust time
    const adjustTime = (deltaMinutes: number) => {
        if (isRunning || isCompletionLoop) return;
        setRemaining((prev) => Math.max(0, prev + deltaMinutes * 60));
    };

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const buttonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: withSpring(buttonScale.value) }],
    }));

    // Animated pulse overlay
    const pulseStyle = useAnimatedStyle(() => ({
        opacity: pulseOpacity.value,
    }));

    // Animated border pulse
    const containerBorderStyle = useAnimatedStyle(() => {
        const opacity = borderPulseOpacity.value;
        return {
            // Removed border styling - now a slot inside FocusCard
            // Keep shadow glow for completion feedback
            shadowColor: isCompletionLoop ? '#A855F7' : 'transparent',
            shadowOpacity: isCompletionLoop ? opacity * 0.5 : 0,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 },
        };
    });

    const isComplete = remaining <= 0 && !isRunning && !isCompletionLoop;

    return (
        <AnimatedView
            entering={FadeInDown.springify().damping(12)}
            exiting={FadeOutDown.duration(200)}
            style={[styles.container, containerBorderStyle]}
        >
            {/* Timer Header */}
            <View style={styles.header}>
                <Clock size={16} color={isCompletionLoop ? '#A855F7' : '#8B5CF6'} strokeWidth={2} />
                <Text style={[styles.headerText, isCompletionLoop && styles.headerTextComplete]}>
                    {isCompletionLoop
                        ? (t('timer.completed') || 'Tamamlandı!')
                        : (t('timer.title') || 'Zamanlayıcı')}
                </Text>
            </View>

            {/* Time Display Row */}
            <View style={styles.timeRow}>
                {/* Decrease Button */}
                <TouchableOpacity
                    style={[styles.adjustButton, (isRunning || isCompletionLoop) && styles.adjustButtonDisabled]}
                    onPress={() => adjustTime(-1)}
                    disabled={isRunning || isCompletionLoop}
                >
                    <Text style={[styles.adjustButtonText, (isRunning || isCompletionLoop) && styles.adjustButtonTextDisabled]}>−</Text>
                </TouchableOpacity>

                {/* Time Display */}
                <View style={[
                    styles.timeDisplay,
                    isComplete && styles.timeDisplayComplete,
                    isCompletionLoop && styles.timeDisplayPulsing
                ]}>
                    <Text style={[
                        styles.timeText,
                        isComplete && styles.timeTextComplete,
                        isCompletionLoop && styles.timeTextPulsing
                    ]}>
                        {formatTime(remaining)}
                    </Text>
                </View>

                {/* Increase Button */}
                <TouchableOpacity
                    style={[styles.adjustButton, (isRunning || isCompletionLoop) && styles.adjustButtonDisabled]}
                    onPress={() => adjustTime(1)}
                    disabled={isRunning || isCompletionLoop}
                >
                    <Text style={[styles.adjustButtonText, (isRunning || isCompletionLoop) && styles.adjustButtonTextDisabled]}>+</Text>
                </TouchableOpacity>
            </View>

            {/* Control Buttons */}
            <View style={styles.controls}>
                {/* Reset Button - hidden during completion */}
                {!isCompletionLoop && (
                    <TouchableOpacity style={styles.controlButton} onPress={handleReset}>
                        <RotateCcw size={18} color="#A1A1AA" strokeWidth={2} />
                    </TouchableOpacity>
                )}

                {/* Main Action Button */}
                <AnimatedTouchableOpacity
                    style={[
                        styles.playButton,
                        isComplete && styles.playButtonComplete,
                        isCompletionLoop && styles.stopButton,
                        buttonStyle
                    ]}
                    onPressIn={() => { buttonScale.value = 0.95; }}
                    onPressOut={() => { buttonScale.value = 1; }}
                    onPress={isCompletionLoop ? handleStop : (isRunning ? handlePause : handleStart)}
                >
                    {isCompletionLoop ? (
                        <Square size={20} color="#FFFFFF" strokeWidth={2.5} fill="#FFFFFF" />
                    ) : isRunning ? (
                        <Pause size={20} color="#FFFFFF" strokeWidth={2.5} fill="#FFFFFF" />
                    ) : (
                        <Play size={20} color="#FFFFFF" strokeWidth={2.5} fill="#FFFFFF" />
                    )}
                </AnimatedTouchableOpacity>

                {/* Spacer for symmetry - hidden during completion */}
                {!isCompletionLoop && <View style={styles.controlButton} />}
            </View>

            {/* Stop hint text during completion */}
            {isCompletionLoop && (
                <Text style={styles.stopHint}>
                    {t('timer.tapToStop') || 'Durdurmak için dokun'}
                </Text>
            )}
        </AnimatedView>
    );
};

const styles = StyleSheet.create({
    container: {
        // Removed card styling - now a slot inside FocusCard
        overflow: 'hidden',
        position: 'relative',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 12,
    },
    headerText: {
        color: '#8B5CF6',
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    headerTextComplete: {
        color: '#A855F7',
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 16,
    },
    adjustButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    adjustButtonDisabled: {
        opacity: 0.3,
    },
    adjustButtonText: {
        color: '#E5E5E5',
        fontSize: 20,
        fontWeight: '500',
    },
    adjustButtonTextDisabled: {
        color: 'rgba(229, 229, 229, 0.3)',
    },
    timeDisplay: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 24,
        minWidth: 120,
        alignItems: 'center',
    },
    timeDisplayComplete: {
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.3)',
    },
    timeDisplayPulsing: {
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(168, 85, 247, 0.5)',
    },
    timeText: {
        color: '#E5E5E5',
        fontSize: 32,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
        letterSpacing: 2,
    },
    timeTextComplete: {
        color: '#A855F7',
    },
    timeTextPulsing: {
        color: '#A855F7',
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
    },
    controlButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#8B5CF6',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#8B5CF6',
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
    },
    playButtonComplete: {
        backgroundColor: '#A855F7',
        shadowColor: '#A855F7',
    },
    stopButton: {
        backgroundColor: '#7C3AED',
        shadowColor: '#7C3AED',
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    stopHint: {
        color: '#A1A1AA',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 12,
    },
});
