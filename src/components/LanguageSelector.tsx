import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useChangeLanguage } from '../lib/i18n/I18nProvider';
import { SUPPORTED_LANGUAGES } from '../lib/i18n';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  tr: 'Türkçe',
};

export const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const { changeLanguage } = useChangeLanguage();
  const currentLanguage = i18n.language;

  const handleLanguageChange = async (language: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await changeLanguage(language);
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };

  const LanguageButton = ({ language }: { language: string }) => {
    const pressed = useSharedValue(0);
    const isSelected = currentLanguage === language;

    const buttonStyle = useAnimatedStyle(() => ({
      transform: [{ scale: withSpring(pressed.value ? 0.96 : 1, { damping: 10, stiffness: 200 }) }],
    }));

    return (
      <AnimatedTouchableOpacity
        onPressIn={() => (pressed.value = 1)}
        onPressOut={() => (pressed.value = 0)}
        onPress={() => handleLanguageChange(language)}
        className={`flex-1 rounded-xl py-3 px-4 mx-1 ${
          isSelected ? 'bg-primary' : 'bg-gray-800 border border-gray-700'
        }`}
        style={buttonStyle}
      >
        <Text
          className={`text-center font-semibold ${isSelected ? 'text-white' : 'text-textMain'}`}
        >
          {LANGUAGE_NAMES[language] || language}
        </Text>
      </AnimatedTouchableOpacity>
    );
  };

  return (
    <View className="mb-6">
      <Text className="text-textMain text-base font-semibold mb-3">Language</Text>
      <View className="flex-row">
        {SUPPORTED_LANGUAGES.map((language) => (
          <LanguageButton key={language} language={language} />
        ))}
      </View>
    </View>
  );
};
