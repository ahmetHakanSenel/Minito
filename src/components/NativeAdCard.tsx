import React from 'react';
import { View, Text } from 'react-native';

interface NativeAdCardProps {
  /**
   * Whether to show the ad. Set to false in Focus Mode.
   */
  showAd?: boolean;
}

/**
 * NativeAdCard - Mock placeholder for development
 * 
 * This shows a realistic preview of how native ads will look.
 * In production, this will be replaced with actual AdMob NativeAdView.
 * 
 * Design matches MINITO_PROJECT_TRACKER.md specifications:
 * - Background: #1E1E1E (Surface Color)
 * - Native, passive, blended into design
 * - Never shown in Focus Mode (Core Law)
 */
export const NativeAdCard: React.FC<NativeAdCardProps> = ({
  showAd = true,
}) => {
  // Never show ads in Focus Mode (Core Law: Focus Mode is Sacred)
  if (!showAd) {
    return null;
  }

  // Mock native ad preview - shows realistic ad appearance
  // This will be replaced with real AdMob NativeAdView in production builds
  return (
    <View className="w-full px-4">
      {/* Ad Label */}
      <View className="flex-row items-center mb-2 px-2">
        <View className="bg-primary/20 px-2 py-0.5 rounded">
          <Text className="text-primary text-xs font-medium">Ad</Text>
        </View>
        <Text className="text-textMuted text-xs ml-2">Sponsored</Text>
      </View>

      {/* Native Ad Card */}
      <View
        style={{
          backgroundColor: '#1E1E1E', // Matches Surface Color
          width: '100%',
          alignSelf: 'center',
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: '#333',
        }}
      >
        {/* Ad Content */}
        <View className="flex-row items-start">
          {/* Ad Icon/Image */}
          <View
            style={{
              width: 48,
              height: 48,
              backgroundColor: '#2A2A2A',
              borderRadius: 8,
              marginRight: 10,
              borderWidth: 1,
              borderColor: '#3A3A3A',
            }}
          >
            <View className="flex-1 items-center justify-center">
              <Text className="text-textMuted text-lg">📱</Text>
            </View>
          </View>

          {/* Ad Text Content */}
          <View className="flex-1">
            {/* Ad Title */}
            <Text className="text-textMain text-sm font-semibold mb-0.5">
              Premium Task Manager
            </Text>
            {/* Ad Description */}
            <Text className="text-textMuted text-xs leading-4" numberOfLines={2}>
              Organize your tasks efficiently with our advanced productivity app. Try it free today!
            </Text>
          </View>
        </View>

        {/* Disclaimer */}
        <Text className="text-textMuted text-xs text-center mt-2 opacity-60">
          This is a preview. Real ads will appear here in production.
        </Text>
      </View>
    </View>
  );
};

