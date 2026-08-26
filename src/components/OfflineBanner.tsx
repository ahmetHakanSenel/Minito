import React from 'react';
import { View, Text } from 'react-native';
import { CloudOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface OfflineBannerProps {
  isVisible: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isVisible,
}) => {
  const { t } = useTranslation();

  if (!isVisible) return null;

  return (
    <View className="bg-yellow-900/30 border-b border-yellow-700/50 px-4 py-2 flex-row items-center justify-center gap-2">
      <CloudOff size={14} color="#FACC15" strokeWidth={2} />
      <Text className="text-yellow-400 text-sm text-center">
        {t('offline.banner')}
      </Text>
    </View>
  );
};
