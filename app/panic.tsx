import React from 'react';
import { View, StatusBar } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PanicKit } from '../src/components';
import { PanicKit as PanicKitType } from '../src/safety/emergencyService';
import { FallbackReason } from '../src/safety';

/**
 * Panic screen content is always rendered from the device's own locale.
 * The server only signals the CONTENT_FLAGGED reason — it never ships
 * copy, so an English user can never receive Turkish crisis text.
 */
export default function PanicScreen() {
  const { t } = useTranslation();

  const panicKit: PanicKitType = {
    reason: FallbackReason.CONTENT_FLAGGED,
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

  return (
    <View className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      {/* NO ADS ALLOWED in Panic Kit screen - Core Law */}
      <PanicKit panicKit={panicKit} />
    </View>
  );
}
