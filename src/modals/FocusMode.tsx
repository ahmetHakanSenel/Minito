import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    StyleSheet,
    Modal,
    Dimensions,
    Platform,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Pause, Play, Smartphone } from 'lucide-react-native';
import Animated, {
    FadeIn,
    FadeOut,
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    Easing,
    cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Accelerometer } from 'expo-sensors';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// ============================================================================
// TYPES
// ============================================================================

export interface FocusModeProps {
    visible: boolean;
    onClose: () => void;
    duration: number; // in seconds
    taskTitle: string;
    projectId?: string;
    taskId?: string;
    onSessionComplete: (data: FocusSessionResult) => void;
}

export interface FocusSessionResult {
    duration: number; // in seconds (actual time spent)
    pickupCount: number;
    completed: boolean;
    projectId?: string;
    taskId?: string;
}

// ============================================================================
// FOCUS MODE COMPONENT - ZEN MODE
// ============================================================================

export const FocusMode: React.FC<FocusModeProps> = ({
    visible,
    onClose,
    duration,
    taskTitle,
    projectId,
    taskId,
    onSessionComplete,
}) => {
    // Keep the screen awake only while a session is actually on screen.
    // This component stays mounted (hidden) inside every ProjectCard, so an
    // unconditional useKeepAwake() would fire one activation per card — and
    // an activation attempted with no resumed Activity rejects with
    // "Unable to activate keep awake", surfacing as an unhandled rejection.
    useEffect(() => {
        if (!visible) return;

        let released = false;
        const tag = `minito-focus-${Math.random().toString(36).slice(2, 9)}`;

        activateKeepAwakeAsync(tag).catch((error) => {
            console.warn('Keep awake could not be activated:', error);
        });

        return () => {
            if (released) return;
            released = true;
            // Returns a promise: a rejection here must be caught, not thrown
            deactivateKeepAwake(tag).catch((error) => {
                console.warn('Keep awake could not be deactivated:', error);
            });
        };
    }, [visible]);

    // Localization
    const { t } = useTranslation();

    // Timer state
    const [remaining, setRemaining] = useState(duration);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    // Orientation state
    const [isLandscape, setIsLandscape] = useState(false);
    const [dimensions, setDimensions] = useState({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });

    // Clock state
    const [currentTime, setCurrentTime] = useState(new Date());
    const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Sensor state
    const [pickupCount, setPickupCount] = useState(0);
    const [showPickupWarning, setShowPickupWarning] = useState(false);
    const accelerometerSubscription = useRef<{ remove: () => void } | null>(null);
    const lastAcceleration = useRef({ x: 0, y: 0, z: 0 });
    const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // UI state - Immersive Mode
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Animation values
    const progressWidth = useSharedValue(0);
    const controlsOpacity = useSharedValue(1);
    const warningOpacity = useSharedValue(0);
    const gradientProgress = useSharedValue(0);

    // ========================================================================
    // INITIALIZATION & CLEANUP
    // ========================================================================

    useEffect(() => {
        if (visible) {
            // Unlock orientation for this screen
            ScreenOrientation.unlockAsync();

            // IMMERSIVE MODE: Hide status bar immediately for zero distractions
            if (Platform.OS === 'android') {
                StatusBar.setHidden(true, 'fade');
                // Also hide navigation bar initially for full immersion
                NavigationBar.setVisibilityAsync('hidden');
                NavigationBar.setBehaviorAsync('overlay-swipe');
                NavigationBar.setBackgroundColorAsync('transparent');
                NavigationBar.setPositionAsync('absolute');
            } else {
                // iOS
                StatusBar.setHidden(true, 'fade');
            }

            // Listen for orientation changes
            const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
                const orientation = event.orientationInfo.orientation;
                const landscape =
                    orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
                    orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
                setIsLandscape(landscape);

                // Keep status bar hidden in ALL orientations for Focus mode
                if (Platform.OS === 'android') {
                    StatusBar.setHidden(true, 'fade');
                    if (landscape) {
                        // Full immersive for landscape
                        NavigationBar.setVisibilityAsync('hidden');
                        NavigationBar.setBehaviorAsync('overlay-swipe');
                        NavigationBar.setBackgroundColorAsync('transparent');
                        NavigationBar.setPositionAsync('absolute');
                    } else {
                        // Portrait: keep nav bar hidden too for consistency
                        NavigationBar.setVisibilityAsync('hidden');
                        NavigationBar.setBehaviorAsync('overlay-swipe');
                    }
                }

                // Update dimensions
                const { width, height } = Dimensions.get('window');
                setDimensions({ width, height });
            });

            // Initial setup
            setRemaining(duration);
            setIsRunning(true);
            setIsPaused(false);
            setPickupCount(0);
            startTimeRef.current = Date.now();
            startAccelerometerTracking();
            startClockUpdates();
            startProgressAnimation();
            hideControlsAfterDelay();

            return () => {
                subscription.remove();
                cleanup();
                // Lock orientation back to portrait when leaving
                ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
                // Restore navigation bar and status bar
                if (Platform.OS === 'android') {
                    NavigationBar.setVisibilityAsync('visible');
                    NavigationBar.setBackgroundColorAsync('#050510');
                    NavigationBar.setPositionAsync('relative');
                    StatusBar.setHidden(false, 'fade');
                } else {
                    StatusBar.setHidden(false, 'fade');
                }
            };
        } else {
            cleanup();
        }
    }, [visible, duration]);

    // Timer effect
    useEffect(() => {
        if (isRunning && !isPaused) {
            timerRef.current = setInterval(() => {
                setRemaining((prev) => {
                    if (prev <= 1) {
                        handleTimerComplete();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isRunning, isPaused]);

    const cleanup = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (clockIntervalRef.current) {
            clearInterval(clockIntervalRef.current);
            clockIntervalRef.current = null;
        }
        if (accelerometerSubscription.current) {
            accelerometerSubscription.current.remove();
            accelerometerSubscription.current = null;
        }
        if (warningTimeoutRef.current) {
            clearTimeout(warningTimeoutRef.current);
            warningTimeoutRef.current = null;
        }
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = null;
        }
        cancelAnimation(progressWidth);
        cancelAnimation(gradientProgress);
        setIsRunning(false);
        setIsPaused(false);
    }, []);

    // ========================================================================
    // CLOCK UPDATES (Every minute for remaining, every second for clock)
    // ========================================================================

    const startClockUpdates = useCallback(() => {
        // Update clock every second
        clockIntervalRef.current = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
    }, []);

    // ========================================================================
    // PROGRESS ANIMATION (Smooth, fluid)
    // ========================================================================

    const startProgressAnimation = useCallback(() => {
        // Animate progress smoothly over the entire duration
        progressWidth.value = 0;
        progressWidth.value = withTiming(100, {
            duration: duration * 1000,
            easing: Easing.linear,
        });

        // Subtle gradient animation
        gradientProgress.value = withTiming(1, {
            duration: 8000,
            easing: Easing.inOut(Easing.sin),
        });
    }, [duration]);

    // ========================================================================
    // IMMERSIVE MODE - Hide/Show Controls
    // ========================================================================

    const hideControlsAfterDelay = useCallback(() => {
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        controlsTimeoutRef.current = setTimeout(() => {
            controlsOpacity.value = withTiming(0, { duration: 500 });
            setShowControls(false);
        }, 3000);
    }, []);

    const handleScreenTap = useCallback(() => {
        if (!showControls) {
            setShowControls(true);
            controlsOpacity.value = withTiming(1, { duration: 200 });
        }
        hideControlsAfterDelay();
    }, [showControls, hideControlsAfterDelay]);

    // ========================================================================
    // TIMER HANDLERS
    // ========================================================================

    const handleTimerComplete = useCallback(() => {
        cleanup();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSessionComplete({
            duration: duration - remaining,
            pickupCount,
            completed: true,
            projectId,
            taskId,
        });
    }, [duration, remaining, pickupCount, projectId, taskId, onSessionComplete, cleanup]);

    const handleCancel = useCallback(() => {
        cleanup();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
    }, [cleanup, onClose]);

    const togglePause = useCallback(() => {
        setIsPaused((prev) => {
            if (prev) {
                // Resuming - restart progress animation from current point
                const elapsed = duration - remaining;
                const remainingProgress = (remaining / duration) * 100;
                progressWidth.value = 100 - remainingProgress;
                progressWidth.value = withTiming(100, {
                    duration: remaining * 1000,
                    easing: Easing.linear,
                });
            } else {
                // Pausing - cancel animation
                cancelAnimation(progressWidth);
            }
            return !prev;
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [remaining, duration]);

    // ========================================================================
    // ACCELEROMETER (PHONE PICKUP DETECTION)
    // ========================================================================

    const startAccelerometerTracking = useCallback(() => {
        Accelerometer.setUpdateInterval(500);

        accelerometerSubscription.current = Accelerometer.addListener((data) => {
            const { x, y, z } = data;
            const last = lastAcceleration.current;

            const deltaX = Math.abs(x - last.x);
            const deltaY = Math.abs(y - last.y);
            const deltaZ = Math.abs(z - last.z);
            const totalDelta = deltaX + deltaY + deltaZ;

            const MOVEMENT_THRESHOLD = 1.2;

            if (totalDelta > MOVEMENT_THRESHOLD) {
                triggerPickupWarning();
            }

            lastAcceleration.current = { x, y, z };
        });
    }, []);

    const triggerPickupWarning = useCallback(() => {
        setPickupCount((prev) => prev + 1);
        setShowPickupWarning(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Smooth cross-fade animation (800ms as per spec)
        warningOpacity.value = withTiming(1, {
            duration: 800,
            easing: Easing.inOut(Easing.ease)
        });

        if (warningTimeoutRef.current) {
            clearTimeout(warningTimeoutRef.current);
        }

        warningTimeoutRef.current = setTimeout(() => {
            warningOpacity.value = withTiming(0, {
                duration: 800,
                easing: Easing.inOut(Easing.ease)
            });
            setTimeout(() => setShowPickupWarning(false), 800);
        }, 4000);
    }, []);

    // ========================================================================
    // FORMAT HELPERS
    // ========================================================================

    const formatClockTime = (date: Date) => {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const formatRemainingMinutes = (seconds: number) => {
        const minutes = Math.ceil(seconds / 60);
        // Zen-Engineer format: No "remaining/kaldı" - just clean info
        return `${minutes} dk • ${t('focusMode.focusLabel')}`;
    };

    // ========================================================================
    // ANIMATED STYLES
    // ========================================================================

    const progressStyle = useAnimatedStyle(() => ({
        width: `${progressWidth.value}%`,
    }));

    const controlsStyle = useAnimatedStyle(() => ({
        opacity: controlsOpacity.value,
    }));

    const warningStyle = useAnimatedStyle(() => ({
        opacity: warningOpacity.value,
    }));

    const gradientStyle = useAnimatedStyle(() => ({
        opacity: 0.3 + gradientProgress.value * 0.2,
    }));

    // ========================================================================
    // RENDER - LANDSCAPE MODE (Desk Clock)
    // ========================================================================

    const renderLandscapeMode = () => (
        <View style={styles.landscapeContainer}>
            {/* StatusBar hidden for true fullscreen - we hide it programmatically too */}
            <StatusBar
                translucent
                backgroundColor="transparent"
                hidden={true}
                barStyle="light-content"
            />

            {/* Pure black OLED background - fills entire screen including notch */}
            <View style={styles.landscapeBackground} />

            {/* Centered Clock */}
            <View style={styles.landscapeClockContainer}>
                <Text style={styles.landscapeClock}>{formatClockTime(currentTime)}</Text>
                {/* Ghost Text: Remaining or Warning - smooth cross-fade */}
                <View style={styles.ghostTextContainer}>
                    <Animated.Text
                        style={[
                            styles.landscapeRemaining,
                            { opacity: showPickupWarning ? 0 : 1 }
                        ]}
                    >
                        {formatRemainingMinutes(remaining)}
                    </Animated.Text>
                    <Animated.Text
                        style={[
                            styles.landscapeWarningText,
                            warningStyle,
                            { position: 'absolute' }
                        ]}
                    >
                        {t('focusMode.gentleWarning')}
                    </Animated.Text>
                </View>
            </View>

            {/* Bottom Progress Line */}
            <View style={styles.landscapeProgressContainer}>
                <Animated.View style={[styles.landscapeProgressFill, progressStyle]}>
                    <LinearGradient
                        colors={['#8B5CF6', '#A855F7', '#D946EF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
            </View>

            {/* Hidden controls - tap to show */}
            <TouchableWithoutFeedback onPress={handleScreenTap}>
                <View style={StyleSheet.absoluteFill}>
                    <AnimatedView style={[styles.landscapeControls, controlsStyle]}>
                        <TouchableOpacity
                            onPress={handleCancel}
                            style={styles.landscapeButton}
                        >
                            <X size={28} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={togglePause}
                            style={styles.landscapeButton}
                        >
                            {isPaused ? (
                                <Play size={28} color="#34D399" fill="#34D399" />
                            ) : (
                                <Pause size={28} color="rgba(255,255,255,0.7)" />
                            )}
                        </TouchableOpacity>
                    </AnimatedView>
                </View>
            </TouchableWithoutFeedback>
        </View>
    );

    // ========================================================================
    // RENDER - PORTRAIT MODE (Zen Mode)
    // ========================================================================

    const renderPortraitMode = () => (
        <TouchableWithoutFeedback onPress={handleScreenTap}>
            <View style={styles.container}>
                {/* Deep Mesh Gradient Background */}
                <AnimatedLinearGradient
                    colors={['#0a0a0f', '#1a0a2e', '#0f1419', '#0a0a0f']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[StyleSheet.absoluteFill, gradientStyle]}
                />

                <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                    {/* Header - Hidden by default */}
                    <AnimatedView style={[styles.header, controlsStyle]}>
                        <TouchableOpacity
                            onPress={handleCancel}
                            style={styles.closeButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <X size={24} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>

                        <Text style={styles.taskTitle} numberOfLines={1}>
                            {taskTitle}
                        </Text>

                        <View style={styles.closeButton} />
                    </AnimatedView>

                    {/* Main Content */}
                    <View style={styles.content}>
                        {/* Current Clock Time (Large) */}
                        <View style={styles.clockContainer}>
                            <Text style={styles.clockTime}>{formatClockTime(currentTime)}</Text>
                        </View>

                        {/* Ghost Text: Remaining Time or Warning - smooth cross-fade */}
                        <View style={styles.portraitGhostContainer}>
                            <Animated.Text
                                style={[
                                    styles.remainingText,
                                    { opacity: showPickupWarning ? 0 : 1 }
                                ]}
                            >
                                {formatRemainingMinutes(remaining)}
                            </Animated.Text>
                            <Animated.Text
                                style={[
                                    styles.portraitWarningText,
                                    warningStyle,
                                    { position: 'absolute' }
                                ]}
                            >
                                {t('focusMode.gentleWarning')}
                            </Animated.Text>
                        </View>

                        {/* Progress Bar (No percentage, smooth) */}
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBar}>
                                <Animated.View style={[styles.progressFill, progressStyle]}>
                                    <LinearGradient
                                        colors={['#8B5CF6', '#A855F7']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={StyleSheet.absoluteFill}
                                    />
                                </Animated.View>
                            </View>
                        </View>

                        {/* Pause Button - Hidden by default */}
                        <AnimatedView style={[styles.pauseContainer, controlsStyle]}>
                            <TouchableOpacity
                                style={styles.pauseButton}
                                onPress={togglePause}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={isPaused ? ['#34D399', '#10B981'] : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.pauseButtonGradient}
                                >
                                    {isPaused ? (
                                        <Play size={24} color="#FFFFFF" fill="#FFFFFF" />
                                    ) : (
                                        <Pause size={24} color="rgba(255,255,255,0.6)" />
                                    )}
                                    <Text style={[
                                        styles.pauseButtonText,
                                        !isPaused && styles.pauseButtonTextMuted
                                    ]}>
                                        {isPaused ? 'Devam Et' : 'Duraklat'}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </AnimatedView>

                        {/* Pickup Count (Subtle) */}
                        {pickupCount > 0 && (
                            <View style={styles.pickupIndicator}>
                                <Smartphone size={14} color="rgba(255,255,255,0.3)" />
                                <Text style={styles.pickupText}>{pickupCount}</Text>
                            </View>
                        )}
                    </View>
                </SafeAreaView>
            </View>
        </TouchableWithoutFeedback>
    );

    // ========================================================================
    // MAIN RENDER
    // ========================================================================

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={handleCancel}
            supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
        >
            <AnimatedView
                entering={FadeIn.duration(300)}
                exiting={FadeOut.duration(200)}
                style={styles.modalContainer}
            >
                {isLandscape ? renderLandscapeMode() : renderPortraitMode()}
            </AnimatedView>
        </Modal>
    );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: '#000000',
        width: '100%',
        height: '100%',
    },
    container: {
        flex: 1,
        backgroundColor: '#0a0a0f',
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    closeButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    taskTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        marginHorizontal: 12,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    warningContainer: {
        position: 'absolute',
        top: 60,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(251, 191, 36, 0.15)',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: 'rgba(251, 191, 36, 0.3)',
    },
    warningText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FBBF24',
    },
    clockContainer: {
        marginBottom: 16,
    },
    clockTime: {
        fontSize: 96,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: -4,
        fontVariant: ['tabular-nums'],
        // Monospace font + Neon glow
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
        textShadowColor: 'rgba(139, 92, 246, 0.6)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 15,
    },
    remainingText: {
        fontSize: 18,
        fontWeight: '600',
        // Zen-Engineer: Monospace Bold, 0.8 opacity (less aggressive than clock)
        color: 'rgba(255,255,255,0.8)',
        opacity: 0.8,
        letterSpacing: 1,
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    },
    portraitGhostContainer: {
        // Container for the cross-fade effect in portrait mode
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 48,
        minHeight: 30,
    },
    portraitWarningText: {
        fontSize: 18,
        fontWeight: '700',
        // Warning state: Soft red with glow
        color: '#F87171',
        letterSpacing: 1,
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
        textShadowColor: 'rgba(248, 113, 113, 0.6)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    progressContainer: {
        width: '70%',
        marginBottom: 48,
    },
    progressBar: {
        // Neon Rail design: 6px height, visible in all lighting
        height: 6,
        backgroundColor: 'rgba(139,92,246,0.15)', // Faint violet track
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
        overflow: 'hidden',
        // Neon glow effect
        shadowColor: '#A855F7',
        shadowOpacity: 0.8,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
    },
    pauseContainer: {
        marginTop: 20,
    },
    pauseButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    pauseButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
        paddingHorizontal: 32,
    },
    pauseButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    pauseButtonTextMuted: {
        color: 'rgba(255,255,255,0.5)',
    },
    pickupIndicator: {
        position: 'absolute',
        bottom: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    pickupText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.25)',
    },

    // Landscape Mode Styles (Desk Clock - True Fullscreen behind notch)
    landscapeContainer: {
        flex: 1,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        // Critical: These ensure we draw behind the notch cutout
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
    },
    landscapeBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
    },
    landscapeClockContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    landscapeClock: {
        // Dynamic font size that scales - massive in landscape
        fontSize: Math.min(Dimensions.get('window').width * 0.18, 160),
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: -2,
        fontVariant: ['tabular-nums'],
        // Monospace font family as per spec
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
        // Neon Tube glow effect
        textShadowColor: 'rgba(139, 92, 246, 0.6)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 15,
    },
    ghostTextContainer: {
        // Container for the cross-fade effect
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        minHeight: 30,
    },
    landscapeRemaining: {
        fontSize: 20,
        fontWeight: '600',
        // Zen-Engineer: Monospace Bold, 0.8 opacity (less aggressive than clock)
        color: 'rgba(255,255,255,0.8)',
        opacity: 0.8,
        letterSpacing: 2,
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    },
    landscapeWarningText: {
        fontSize: 20,
        fontWeight: '700',
        // Warning state: Soft red with glow
        color: '#F87171',
        letterSpacing: 2,
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
        textShadowColor: 'rgba(248, 113, 113, 0.6)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    landscapeProgressContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        // Neon Rail design: 5px height for landscape (desk mode visibility)
        height: 5,
        backgroundColor: 'rgba(139,92,246,0.12)', // Faint violet track
    },
    landscapeProgressFill: {
        height: '100%',
        overflow: 'hidden',
        shadowColor: '#A855F7',
        shadowOpacity: 0.6,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
    },
    landscapeControls: {
        position: 'absolute',
        top: 16,
        right: 16,
        flexDirection: 'row',
        gap: 12,
    },
    landscapeButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default FocusMode;
