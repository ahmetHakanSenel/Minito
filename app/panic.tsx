import React from 'react';
import { View, StatusBar } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PanicKit } from '../src/components';
import { PanicKit as PanicKitType } from '../src/safety/emergencyService';

export default function PanicScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ panicKit: string }>();

  let panicKit: PanicKitType | null = null;
  try {
    if (params.panicKit) {
      panicKit = JSON.parse(params.panicKit) as PanicKitType;
    }
  } catch (error) {
    console.error('Failed to parse panic kit:', error);
  }

  // Fallback panic kit if parsing fails
  if (!panicKit) {
    panicKit = {
      reason: 'CONTENT_FLAGGED' as const,
      headline: t('panic.headline'),
      tone: 'calm',
      steps: [
        {
          id: 'pause',
          title: t('panic.steps.pause.title'),
          body: t('panic.steps.pause.body'),
        },
        {
          id: 'grounding',
          title: t('panic.steps.grounding.title'),
          body: t('panic.steps.grounding.body'),
        },
        {
          id: 'support',
          title: t('panic.steps.support.title'),
          body: t('panic.steps.support.body'),
        },
      ],
    };
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      {/* NO ADS ALLOWED in Panic Kit screen - Core Law */}
      <PanicKit panicKit={panicKit} />
    </View>
  );
}

