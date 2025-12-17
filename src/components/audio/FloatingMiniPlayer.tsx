import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Play, Pause, Volume2 } from 'lucide-react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSpring,
    Easing,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAudioContext } from '../../context';

const { width } = Dimensions.get('window');
const PLAYER_WIDTH = width * 0.9;

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// Simple waveform animation bars
const WaveformBar: React.FC<{ delay: number; isActive: boolean }> = ({ delay, isActive }) => {
    const height = useSharedValue(4);

    React.useEffect(() => {
        if (isActive) {
            height.value = withRepeat(
                withTiming(16, {
                    duration: 400 + delay * 100,
                    easing: Easing.inOut(Easing.ease)
                }),
                -1,
                true
            );
        } else {
            height.value = withTiming(4, { duration: 200 });
        }
    }, [isActive, delay]);

    const animatedStyle = useAnimatedStyle(() => ({
        height: height.value,
    }));

    return (
        <AnimatedView style={[styles.waveformBar, animatedStyle]} />
    );
};

export const FloatingMiniPlayer: React.FC = () => {
    const insets = useSafeAreaInsets();
    const { isPlaying, currentTrack, play, pause, resume } = useAudioContext();

    const buttonScale = useSharedValue(1);

    // Don't show if no track is selected
    if (!currentTrack) {
        return null;
    }

    const handlePlayPause = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (isPlaying) {
            await pause();
        } else {
            await resume();
        }
    };

    const handlePressIn = () => {
        buttonScale.value = withSpring(0.92, { damping: 15, stiffness: 300 });
    };

    const handlePressOut = () => {
        buttonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
    };

    const buttonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
    }));

    const glowColor = currentTrack?.color || '#8B5CF6';

    return (
        <AnimatedView
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            style={[
                styles.container,
                {
                    bottom: Math.max(insets.bottom, 16) + 16,
                    shadowColor: glowColor,
                },
            ]}
        >
            <BlurView intensity={30} tint="dark" style={styles.blurContainer}>
                <View style={styles.content}>
                    {/* Waveform */}
                    <View style={styles.waveformContainer}>
                        {[0, 1, 2, 3, 4].map((i) => (
                            <WaveformBar key={i} delay={i} isActive={isPlaying} />
                        ))}
                    </View>

                    {/* Track Info */}
                    <View style={styles.trackInfo}>
                        <Text style={styles.nowPlayingLabel} numberOfLines={1}>
                            Şu an Çalıyor
                        </Text>
                        <Text style={styles.trackName} numberOfLines={1}>
                            {currentTrack.name} ({currentTrack.description})
                        </Text>
                    </View>

                    {/* Play/Pause Button */}
                    <AnimatedTouchableOpacity
                        style={[styles.playButton, buttonStyle]}
                        onPress={handlePlayPause}
                        onPressIn={handlePressIn}
                        onPressOut={handlePressOut}
                        activeOpacity={1}
                    >
                        {isPlaying ? (
                            <Pause size={20} color="#FFFFFF" strokeWidth={2.5} fill="#FFFFFF" />
                        ) : (
                            <Play size={20} color="#FFFFFF" strokeWidth={2.5} fill="#FFFFFF" />
                        )}
                    </AnimatedTouchableOpacity>
                </View>
            </BlurView>
        </AnimatedView>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: (width - PLAYER_WIDTH) / 2,
        width: PLAYER_WIDTH,
        height: 64,
        borderRadius: 32,
        overflow: 'hidden',
        zIndex: 100,
        // Neon glow
        shadowOpacity: 0.6,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 0 },
        elevation: 15,
    },
    blurContainer: {
        flex: 1,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 12,
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        height: 24,
    },
    waveformBar: {
        width: 3,
        backgroundColor: '#8B5CF6',
        borderRadius: 2,
        minHeight: 4,
    },
    trackInfo: {
        flex: 1,
    },
    nowPlayingLabel: {
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.5)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 2,
    },
    trackName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    playButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#8B5CF6',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
