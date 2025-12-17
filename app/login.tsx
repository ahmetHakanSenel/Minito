import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
// Apple Sign In temporarily disabled - will be implemented in the future
// import { useAuth, isAppleSignInAvailable, isGoogleSignInAvailable } from '../src/lib/auth';
import { useAuth, isGoogleSignInAvailable } from '../src/lib/auth';
import { MinitoIcon } from '../src/components';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // Apple Sign In temporarily disabled - will be implemented in the future
  // const { signInWithApple, signInWithGoogle, loading } = useAuth();
  const { signInWithGoogle, loading } = useAuth();
  // const [appleAvailable, setAppleAvailable] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check availability on mount
  React.useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    // Apple Sign In temporarily disabled
    // const apple = isAppleSignInAvailable();
    const google = await isGoogleSignInAvailable();
    // setAppleAvailable(apple);
    setGoogleAvailable(google);
  };

  // Apple Sign In handler - temporarily disabled, will be implemented in the future
  // const handleAppleSignIn = async () => {
  //   try {
  //     setError(null);
  //     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  //     await signInWithApple();
  //     Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  //     router.replace('/');
  //   } catch (err: any) {
  //     if (err.message !== 'Apple Sign In was cancelled') {
  //       setError(err.message || t('errors.signInFailed'));
  //       Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  //     }
  //   }
  // };

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await signInWithGoogle();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } catch (err: any) {
      if (err.message !== 'Google Sign In was cancelled') {
        setError(err.message || t('errors.signInFailed'));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/');
  };

  // Apple Sign In button - temporarily disabled, will be implemented in the future
  // const AppleButton = ({ onPress }: { onPress: () => void }) => {
  //   const pressed = useSharedValue(0);
  //   const buttonStyle = useAnimatedStyle(() => ({
  //     transform: [{ scale: withSpring(pressed.value ? 0.96 : 1, { damping: 10, stiffness: 200 }) }],
  //   }));

  //   return (
  //     <AnimatedTouchableOpacity
  //       onPressIn={() => (pressed.value = 1)}
  //       onPressOut={() => (pressed.value = 0)}
  //       onPress={onPress}
  //       disabled={loading || !appleAvailable}
  //       className="bg-white rounded-xl py-4 px-6 mb-4"
  //       style={buttonStyle}
  //     >
  //       <Text className="text-black text-center font-semibold text-lg">
  //         {t('login.continueWithApple')}
  //       </Text>
  //     </AnimatedTouchableOpacity>
  //   );
  // };

  const GoogleButton = ({ onPress }: { onPress: () => void }) => {
    const pressed = useSharedValue(0);
    const buttonStyle = useAnimatedStyle(() => ({
      transform: [{ scale: withSpring(pressed.value ? 0.96 : 1, { damping: 10, stiffness: 200 }) }],
    }));

    return (
      <AnimatedTouchableOpacity
        onPressIn={() => (pressed.value = 1)}
        onPressOut={() => (pressed.value = 0)}
        onPress={onPress}
        disabled={loading || !googleAvailable}
        className="bg-gray-800 border border-gray-700 rounded-xl py-4 px-6 mb-4"
        style={buttonStyle}
      >
        <Text className="text-textMain text-center font-semibold text-lg">
          {t('login.continueWithGoogle')}
        </Text>
      </AnimatedTouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-background justify-center items-center px-6">
      <StatusBar barStyle="light-content" />
      
      {/* Logo */}
      <View className="mb-12">
        <MinitoIcon size={100} />
      </View>

      {/* Title */}
      <Text className="text-textMain text-3xl font-bold text-center mb-4">
        {t('login.title')}
      </Text>
      <Text className="text-textMuted text-base text-center mb-8">
        {t('login.subtitle')}
      </Text>

      {/* Error Message */}
      {error && (
        <View className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 w-full">
          <Text className="text-red-400 text-center text-sm">{error}</Text>
        </View>
      )}

      {/* Sign In Buttons */}
      <View className="w-full mb-6">
        {/* Apple Sign In - Temporarily disabled, will be implemented in the future */}
        {/* {Platform.OS === 'ios' && appleAvailable && (
          <AppleButton onPress={handleAppleSignIn} />
        )} */}
        {googleAvailable && (
          <GoogleButton onPress={handleGoogleSignIn} />
        )}
      </View>

      {/* Loading Indicator */}
      {loading && (
        <View className="mb-6">
          <ActivityIndicator size="small" color="#8B5CF6" />
        </View>
      )}

      {/* Skip Button */}
      <TouchableOpacity
        onPress={handleSkip}
        disabled={loading}
        className="mt-4"
      >
        <Text className="text-textMuted text-center text-sm">
          {t('login.continueAsGuest')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

