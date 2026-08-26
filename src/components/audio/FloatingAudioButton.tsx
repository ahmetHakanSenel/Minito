import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { AudioLines, Music2, Pause, Play, Square, Volume2 } from 'lucide-react-native';
import Animated, {
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideOutDown,
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    cancelAnimation,
    Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useAudioContext, AUDIO_TRACKS, AudioTrack } from '../../context';
import { SoftGlow } from '../SoftGlow';

const AnimatedView = Animated.createAnimatedComponent(View);

// Screens where no audio control may appear at all
const HIDDEN_ROUTES = ['/panic'];

// ============================================================================
// FLOATING AUDIO BUTTON — a 48px orb instead of a full-width bar.
// Tap opens a bottom sheet with the track list, play/pause and stop.
// ============================================================================

export const FloatingAudioButton: React.FC = () => {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const pathname = usePathname();
    const { currentTrack, isPlaying, play, pause, resume, stop } = useAudioContext();
    const [sheetVisible, setSheetVisible] = useState(false);

    // Subtle breathing while playing — the only motion this button makes.
    // All hooks stay above any conditional return (hook-order rule).
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
    }, [isPlaying]);

    const glowStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

    const isHiddenRoute = HIDDEN_ROUTES.includes(pathname);

    // On the focus step flow the button stays available but recedes —
    // present if you need it, invisible when you don't look for it.
    const isQuietRoute = pathname === '/focus';

    if (isHiddenRoute) {
        return null;
    }

    // Two visual states: a quiet neutral shortcut with no track selected,
    // and a track-tinted, breathing orb once something is playing/paused.
    const hasTrack = !!currentTrack;
    const trackColor = currentTrack?.color || '#8B5CF6';
    const Icon = hasTrack ? AudioLines : Music2;
    const iconColor = hasTrack ? trackColor : 'rgba(255, 255, 255, 0.55)';

    const openSheet = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSheetVisible(true);
    };

    const closeSheet = () => setSheetVisible(false);

    const handleTrackPress = async (track: AudioTrack) => {
        Haptics.selectionAsync();
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSheetVisible(false);
        await stop();
    };

    return (
        <>
            <AnimatedView
                entering={FadeIn.duration(300)}
                exiting={FadeOut.duration(200)}
                style={[
                    styles.orbContainer,
                    {
                        bottom: Math.max(insets.bottom, 16) + 16,
                        opacity: isQuietRoute ? (hasTrack ? 0.55 : 0.4) : 1,
                    },
                ]}
            >
                {/* Glow only exists once a track is selected — a silent
                    shortcut stays flat and unobtrusive, never glowing */}
                {hasTrack && (
                    <Animated.View style={[StyleSheet.absoluteFill, glowStyle]} pointerEvents="none">
                        <SoftGlow color={trackColor} intensity={0.4} spread={16} />
                    </Animated.View>
                )}
                <TouchableOpacity
                    style={[styles.orb, !hasTrack && styles.orbIdle]}
                    onPress={openSheet}
                    activeOpacity={0.8}
                >
                    <Icon size={20} color={iconColor} strokeWidth={hasTrack ? 2 : 1.8} />
                </TouchableOpacity>
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
                    <AnimatedView entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill} />
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
                                    <Text style={styles.trackName}>{track.name}</Text>
                                    <Text style={styles.trackDesc}>{track.description}</Text>
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
        width: 48,
        height: 48,
        zIndex: 100,
    },
    orb: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(18, 18, 28, 0.88)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    // No track selected: flatter, dimmer — a shortcut you notice only if
    // you look for it, never one that competes for attention.
    orbIdle: {
        backgroundColor: 'rgba(18, 18, 28, 0.55)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
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
