import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PanicKit as PanicKitType } from '../safety/emergencyService';

interface PanicKitProps {
  panicKit: PanicKitType;
}

export const PanicKit: React.FC<PanicKitProps> = ({ panicKit }) => {
  const { t } = useTranslation();

  const headline = panicKit.headline || t('panic.headline');
  const description = t('panic.description', {
    defaultValue: 'Take your time. These steps are here to help you feel grounded.',
  });
  const footer = t('panic.footer', {
    defaultValue: "Remember: You're not alone. It's okay to ask for help.",
  });

  return (
    <ScrollView className="flex-1 bg-background px-4 py-6">
      <View className="mb-6">
        <Text className="text-textMain text-2xl font-bold mb-2">{headline}</Text>
        <Text className="text-textMuted text-base">{description}</Text>
      </View>

      {panicKit.steps.map((step, index) => (
        <View key={step.id} className="bg-surface rounded-2xl p-5 mb-4 border border-gray-800">
          <View className="flex-row items-start mb-3">
            <View className="bg-primary rounded-full w-8 h-8 items-center justify-center mr-3">
              <Text className="text-white font-bold text-sm">{index + 1}</Text>
            </View>
            <Text className="text-textMain text-lg font-semibold flex-1">
              {step.title ||
                t(`panic.steps.${step.id}.title`, {
                  defaultValue: step.title,
                })}
            </Text>
          </View>
          <Text className="text-textMuted text-base leading-6 ml-11">
            {step.body ||
              t(`panic.steps.${step.id}.body`, {
                defaultValue: step.body,
              })}
          </Text>
        </View>
      ))}

      <View className="mt-4 p-4 bg-surface rounded-xl border border-gray-800">
        <Text className="text-textMuted text-sm text-center">{footer}</Text>
      </View>
    </ScrollView>
  );
};
