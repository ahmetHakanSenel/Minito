import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, G, Filter, FeGaussianBlur, FeComposite } from 'react-native-svg';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedProps,
    withRepeat,
    withSequence,
    withTiming,
    interpolateColor,
    Easing,
} from 'react-native-reanimated';

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

interface StreakFlameProps {
    streakDays: number;
    isActive?: boolean;
    size?: 'small' | 'medium' | 'large';
}

export const StreakFlame: React.FC<StreakFlameProps> = ({
    streakDays,
    isActive = false,
    size = 'medium',
}) => {
    const flameScale = useSharedValue(1);
    const flameGlow = useSharedValue(0);
    const innerFlameOffset = useSharedValue(0);

    const sizes = {
        small: { container: 48, svg: 32, text: 12, glow: 8 },
        medium: { container: 64, svg: 44, text: 14, glow: 12 },
        large: { container: 80, svg: 56, text: 18, glow: 16 },
    };

    const currentSize = sizes[size];

    // Holographic flame animation
    React.useEffect(() => {
        if (isActive) {
            // Breathing scale
            flameScale.value = withRepeat(
                withSequence(
                    withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.sin) }),
                    withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) })
                ),
                -1,
                true
            );
            // Glow pulse
            flameGlow.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
                    withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.sin) })
                ),
                -1,
                true
            );
            // Inner flame flicker
            innerFlameOffset.value = withRepeat(
                withSequence(
                    withTiming(2, { duration: 400, easing: Easing.inOut(Easing.ease) }),
                    withTiming(-1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 350, easing: Easing.inOut(Easing.ease) }),
                    withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                false
            );
        } else {
            flameScale.value = withTiming(1, { duration: 300 });
            flameGlow.value = withTiming(0, { duration: 300 });
            innerFlameOffset.value = withTiming(0, { duration: 300 });
        }
    }, [isActive]);

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: flameScale.value }],
        opacity: isActive ? 1 : 0.4,
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: flameGlow.value * 0.6,
        transform: [{ scale: 1 + flameGlow.value * 0.15 }],
    }));

    return (
        <View style={styles.wrapper}>
            {/* Outer Glow Layer */}
            {isActive && (
                <AnimatedView
                    style={[
                        styles.glowLayer,
                        {
                            width: currentSize.container + currentSize.glow * 2,
                            height: currentSize.container + currentSize.glow * 2,
                            borderRadius: (currentSize.container + currentSize.glow * 2) / 2,
                        },
                        glowStyle,
                    ]}
                />
            )}

            {/* Main Flame Container */}
            <AnimatedView
                style={[
                    styles.container,
                    {
                        width: currentSize.container,
                        height: currentSize.container,
                    },
                    containerStyle,
                ]}
            >
                <Svg
                    width={currentSize.svg}
                    height={currentSize.svg}
                    viewBox="0 0 24 24"
                    fill="none"
                >
                    <Defs>
                        {/* Holographic Gradient - Orange to Pink to Purple */}
                        <LinearGradient id="holoFlame" x1="0%" y1="100%" x2="100%" y2="0%">
                            <Stop offset="0%" stopColor="#FF6B35" stopOpacity="1" />
                            <Stop offset="30%" stopColor="#F72585" stopOpacity="1" />
                            <Stop offset="60%" stopColor="#B5179E" stopOpacity="1" />
                            <Stop offset="100%" stopColor="#7209B7" stopOpacity="1" />
                        </LinearGradient>

                        {/* Inner Core Gradient */}
                        <LinearGradient id="innerCore" x1="0%" y1="100%" x2="0%" y2="0%">
                            <Stop offset="0%" stopColor="#FFBE0B" stopOpacity="1" />
                            <Stop offset="50%" stopColor="#FB5607" stopOpacity="1" />
                            <Stop offset="100%" stopColor="#FF006E" stopOpacity="0.8" />
                        </LinearGradient>

                        {/* Inactive Gradient */}
                        <LinearGradient id="inactiveFlame" x1="0%" y1="100%" x2="0%" y2="0%">
                            <Stop offset="0%" stopColor="#4A4A4A" stopOpacity="0.4" />
                            <Stop offset="100%" stopColor="#2A2A2A" stopOpacity="0.3" />
                        </LinearGradient>
                    </Defs>

                    {/* Main Flame Shape */}
                    <Path
                        d="M12 2C12 2 8 8 8 12C8 14.5 9.5 17 12 17C14.5 17 16 14.5 16 12C16 8 12 2 12 2Z"
                        fill={isActive ? "url(#holoFlame)" : "url(#inactiveFlame)"}
                    />

                    {/* Outer Flame Tendrils */}
                    <Path
                        d="M12 2C12 2 6 9 6 13C6 16 8.5 19 12 19C15.5 19 18 16 18 13C18 9 12 2 12 2Z"
                        fill="none"
                        stroke={isActive ? "url(#holoFlame)" : "rgba(255,255,255,0.15)"}
                        strokeWidth="0.5"
                        strokeOpacity={isActive ? 0.6 : 0.3}
                    />

                    {/* Inner Core - brighter center */}
                    {isActive && (
                        <Path
                            d="M12 8C12 8 10 11 10 13C10 14.5 10.8 15.5 12 15.5C13.2 15.5 14 14.5 14 13C14 11 12 8 12 8Z"
                            fill="url(#innerCore)"
                        />
                    )}

                    {/* Hot spot - brightest point */}
                    {isActive && (
                        <Path
                            d="M12 11C12 11 11 12.5 11 13.5C11 14.2 11.4 14.8 12 14.8C12.6 14.8 13 14.2 13 13.5C13 12.5 12 11 12 11Z"
                            fill="#FFF7ED"
                            opacity={0.9}
                        />
                    )}

                    {/* Ember base */}
                    <Path
                        d="M9 18C9 18 10 20 12 20C14 20 15 18 15 18"
                        fill="none"
                        stroke={isActive ? "#FF6B35" : "rgba(255,255,255,0.1)"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        opacity={isActive ? 0.8 : 0.2}
                    />
                </Svg>
            </AnimatedView>

            {/* Streak Count Badge */}
            {streakDays > 0 && (
                <View style={styles.badgeContainer}>
                    <Text style={[
                        styles.badgeText,
                        { fontSize: currentSize.text },
                        isActive && styles.badgeTextActive
                    ]}>
                        {streakDays}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    glowLayer: {
        position: 'absolute',
        backgroundColor: 'transparent',
        shadowColor: '#F72585',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        // No `elevation`: on a transparent view Android falls back to the
        // rectangular bounds and stamps a hard grey box onto the black.
        // Holographic glow effect
        borderWidth: 1,
        borderColor: 'rgba(247, 37, 133, 0.3)',
    },
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeContainer: {
        marginTop: 6,
    },
    badgeText: {
        fontWeight: '800',
        color: 'rgba(255, 255, 255, 0.5)',
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    badgeTextActive: {
        color: '#FFFFFF',
        textShadowColor: 'rgba(247, 37, 133, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
    },
});
