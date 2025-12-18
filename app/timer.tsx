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
import { ArrowLeft, Target } from 'lucide-react-native';
import { useProjects } from '../src/context/ProjectContext';

const AnimatedView = Animated.createAnimatedComponent(View);

type TimerParams = {
    minutes?: string;
    seconds?: string;
    taskContext?: string;
    projectId?: string;
    taskId?: string;
};

export default function TimerScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<TimerParams>();
    const { completeTaskById } = useProjects();

    // Task context from Planner (Flow Bridge)
    const taskContext = params.taskContext;
    const projectId = params.projectId;
    const taskId = params.taskId;

    // Default to 25 minutes (Pomodoro)
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

    // Animations
    const inputTranslateY = useSharedValue(40);
    const timerOpacity = useSharedValue(0);
    const pulseOpacity = useSharedValue(0);
    const borderPulseOpacity = useSharedValue(1);

    useEffect(() => {
        inputTranslateY.value = withSpring(0, { damping: 14, stiffness: 120 });
        timerOpacity.value = withSpring(1, { damping: 18, stiffness: 120 });
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (completionHapticRef.current) clearInterval(completionHapticRef.current);
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

    const borderPulseStyle = useAnimatedStyle(() => {
        const opacity = borderPulseOpacity.value;
        return {
            borderColor: `rgba(168, 85, 247, ${opacity})`,
            shadowColor: '#A855F7',
            shadowOpacity: opacity * 0.5,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 },
            elevation: opacity > 0.5 ? 8 : 0,
        };
    });

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

        completionTimeoutsRef.current.forEach((id) => clearTimeout(id));
        completionTimeoutsRef.current = [];

        tripleHapticBurst();

        // FLOW BRIDGE: Mark task as complete when timer ends successfully
        if (projectId && taskId) {
            completeTaskById(projectId, taskId);
        }

        pulseOpacity.value = withRepeat(
            withTiming(0.55, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
            -1,
            true,
        );

        borderPulseOpacity.value = withRepeat(
            withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
            -1,
            true,
        );

        if (completionHapticRef.current) clearInterval(completionHapticRef.current);
        completionHapticRef.current = setInterval(() => tripleHapticBurst(), 4000);
    };

    const handleStart = () => {
        if (isCompletionLoop || isRunning) return;
        if (remaining <= 0) {
            const freshTotal = minutes * 60 + seconds;
            setRemaining(freshTotal);
            if (freshTotal <= 0) return;
        }

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
        setIsCompletionLoop(false);
        Haptics.selectionAsync();
    };

    const handleReset = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setIsRunning(false);
        setIsCompletionLoop(false);
        cancelAnimation(pulseOpacity);
        pulseOpacity.value = 0;
        cancelAnimation(borderPulseOpacity);
        borderPulseOpacity.value = 1;
        setMinutes(initialMinutes);
        setSeconds(initialSeconds);
        setRemaining(initialMinutes * 60 + initialSeconds);
    };

    const handleAcknowledgeComplete = () => {
        setIsCompletionLoop(false);
        cancelAnimation(pulseOpacity);
        pulseOpacity.value = withTiming(0, { duration: 500, easing: Easing.inOut(Easing.sin) });
        cancelAnimation(borderPulseOpacity);
        borderPulseOpacity.value = 1;
        if (completionHapticRef.current) {
            clearInterval(completionHapticRef.current);
            completionHapticRef.current = null;
        }
        completionTimeoutsRef.current.forEach((id) => clearTimeout(id));
        completionTimeoutsRef.current = [];
    };

    const handleBack = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setIsRunning(false);
        setIsCompletionLoop(false);
        cancelAnimation(borderPulseOpacity);
        borderPulseOpacity.value = 1;
        if (completionHapticRef.current) {
            clearInterval(completionHapticRef.current);
            completionHapticRef.current = null;
        }
        router.back();
    };

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const isAtZero = remaining <= 0;
    const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
    const ss = (remaining % 60).toString().padStart(2, '0');

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <StatusBar barStyle="light-content" />

            {/* Completion pulse overlay */}
            <AnimatedView pointerEvents="none" style={[styles.pulseOverlay, pulseStyle]} />

            <View style={styles.container}>
                {/* Header with back button */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <ArrowLeft size={24} color="#E5E5E5" strokeWidth={2} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Zamanlayıcı</Text>
                    <View style={styles.backButton} />
                </View>

                {/* Task Context Banner (Flow Bridge) */}
                {taskContext && (
                    <View style={styles.taskContextBanner}>
                        <Target size={16} color="#8B5CF6" />
                        <Text style={styles.taskContextText} numberOfLines={1}>
                            {taskContext}
                        </Text>
                    </View>
                )}

                {/* Timer card */}
                <AnimatedView
                    style={[
                        styles.timerCard,
                        !isCompletionLoop && styles.cardReset,
                        isCompletionLoop && borderPulseStyle,
                        timerCardStyle,
                    ]}
                >
                    <Text style={styles.timerLabel}>Süre</Text>

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

                    {/* Ghost buttons */}
                    <View style={styles.ghostRow}>
                        <TouchableOpacity style={styles.ghostButton} onPress={handleBack}>
                            <Text style={styles.ghostButtonText}>Geri</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.ghostButton} onPress={handleReset}>
                            <Text style={styles.ghostButtonText}>Sıfırla</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Hero button */}
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
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#E5E5E5',
        fontSize: 18,
        fontWeight: '600',
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
    taskContextBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    taskContextText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: '#FFFFFF',
    },
    timerCard: {
        backgroundColor: '#1E1E1E',
        borderRadius: 24,
        paddingVertical: 28,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        zIndex: 2,
        marginTop: 40,
    },
    cardReset: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowOpacity: 0,
        elevation: 0,
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
    adjustButtonText: {
        color: '#E5E5E5',
        fontSize: 20,
        fontWeight: '500',
    },
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
});
