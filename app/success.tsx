import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { ZoomIn, FadeIn } from 'react-native-reanimated';
import { SuccessIcon } from '../src/components';
import { getRandomSuccessMessage } from '../src/lib/SuccessMessages';

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedText = Animated.createAnimatedComponent(Text);

export default function SuccessScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ totalSteps: string; input: string }>();
  const totalSteps = parseInt(params.totalSteps || '0', 10);

  // Get random success message based on current language (creates novelty for ADHD engagement)
  const successMessage = useMemo(() => {
    const currentLanguage = (i18n.language || 'en').split('-')[0] as 'en' | 'tr';
    return getRandomSuccessMessage(currentLanguage);
  }, [i18n.language]);

  const handleGoHome = () => {
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent', zIndex: 10 }}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: 'transparent', zIndex: 10 }}>
        <ScrollView
          style={{ flex: 1, backgroundColor: 'transparent' }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingVertical: 40,
          }}
        >
          <View className="flex-1 justify-center items-center px-6">
            {/* Large, Glowing Lucide Icon - Zoom In with Spring */}
            <AnimatedView
              entering={ZoomIn.springify().damping(12).mass(0.8).stiffness(150)}
              className="mb-8"
            >
              <SuccessIcon
                iconName={successMessage.icon}
                color={successMessage.color}
                size={80}
                animated={false}
              />
            </AnimatedView>

            {/* Motivational text - Fades in after icon */}
            <AnimatedText
              entering={FadeIn.delay(300).springify().damping(12).mass(0.8).stiffness(150)}
              className="text-textMain text-3xl font-bold text-center mb-4"
            >
              {successMessage[i18n.language?.split('-')[0] === 'tr' ? 'tr' : 'en']}
            </AnimatedText>
            <AnimatedText
              entering={FadeIn.delay(500).springify().damping(12).mass(0.8).stiffness(150)}
              className="text-textMuted text-lg text-center mb-2"
            >
              {t('success.subtitle', { count: totalSteps })}
            </AnimatedText>
            {params.input && (
              <AnimatedText
                entering={FadeIn.delay(700).springify().damping(12).mass(0.8).stiffness(150)}
                className="text-textMuted text-base text-center mb-8"
              >
                "{params.input}"
              </AnimatedText>
            )}

            <AnimatedView entering={FadeIn.delay(900).springify().damping(12).mass(0.8).stiffness(150)}>
              <TouchableOpacity
                onPress={handleGoHome}
                className="bg-primary rounded-2xl py-4 px-8 mb-8"
              >
                <Text className="text-white text-lg font-semibold">
                  {t('success.breakAnother')}
                </Text>
              </TouchableOpacity>
            </AnimatedView>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

