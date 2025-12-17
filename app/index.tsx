import React, { useState, useRef } from 'react';
import { View, ScrollView, StatusBar, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TaskInput, OfflineBanner, MinitoIcon, NativeAdCard } from '../src/components';
import { HeaderUserWidget } from '../src/components/layout';
import { DashboardModal } from '../src/modals';
import { breakTask } from '../src/lib/api';
import { getOrCreateGuestId } from '../src/lib/guestIdentity';
import { FallbackReason } from '../src/safety';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isDashboardVisible, setIsDashboardVisible] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lastHapticTime = useRef<number>(0);

  // GOD MODE: Selection haptic on scroll/swipe (debounced to avoid spam)
  const handleScroll = () => {
    const now = Date.now();
    // Only trigger haptic every 300ms to avoid overwhelming
    if (now - lastHapticTime.current > 300) {
      Haptics.selectionAsync();
      lastHapticTime.current = now;
    }
  };

  const handleBreakTask = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    setIsOffline(false);

    try {
      // All inputs go to AI - timer will be shown in Focus screen if step contains time
      const guestId = await getOrCreateGuestId();
      const result = await breakTask(input.trim(), guestId);

      if (result.success && result.steps) {
        // Show offline banner if using fallback content
        if (result.isOfflineFallback) {
          setIsOffline(true);
        }

        // Navigate to focus mode with steps and neuro-companion data
        router.push({
          pathname: '/focus',
          params: {
            steps: JSON.stringify(result.steps),
            input: input.trim(),
            empathyBridge: result.empathyBridge || '',
            firstStepHook: result.firstStepHook || '',
          },
        });
      } else if (!result.success) {
        // Handle fallback cases - TypeScript now knows result is the failure type
        if (result.fallbackReason === FallbackReason.CONTENT_FLAGGED && result.panicKit) {
          router.push({
            pathname: '/panic',
            params: {
              panicKit: JSON.stringify(result.panicKit),
            },
          });
        } else {
          // For DB_DOWN or AI_DOWN, try to show offline fallback as last resort
          if (
            result.fallbackReason === FallbackReason.DB_DOWN ||
            result.fallbackReason === FallbackReason.AI_DOWN
          ) {
            // This shouldn't happen if offline fallback worked, but just in case
            console.warn('Failed to break task:', result.fallbackReason);
            setIsOffline(true);
          } else {
            // Show error for other cases
            console.warn('Failed to break task:', result.fallbackReason);
          }
        }
      }
    } catch (error) {
      console.error('Error breaking task:', error);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDashboardNavigate = (screen: string) => {
    switch (screen) {
      case 'planner':
        router.push('/planner');
        break;
      case 'sounds':
        router.push('/sounds');
        break;
      case 'stats':
        router.push('/stats');
        break;
      case 'settings':
        router.push('/settings');
        break;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent', zIndex: 10 }}>
      <StatusBar barStyle="light-content" />
      <OfflineBanner isVisible={isOffline} />

      {/* Header User Widget - Top Right */}
      <View style={[styles.headerWidget, { top: insets.top + 8 }]}>
        <HeaderUserWidget onPress={() => setIsDashboardVisible(true)} />
      </View>

      {/* Dashboard Modal */}
      <DashboardModal
        visible={isDashboardVisible}
        onClose={() => setIsDashboardVisible(false)}
        userName="Kullanıcı"
        isPremium={false}
        onNavigate={handleDashboardNavigate}
      />

      <View style={{ flex: 1, backgroundColor: 'transparent', zIndex: 10 }}>
        <ScrollView
          style={{ flex: 1, backgroundColor: 'transparent' }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingVertical: 40,
            paddingBottom: 120, // Space for ad at bottom
          }}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <View className="flex-1 justify-center px-4">
            <View className="items-center mb-4">
              <MinitoIcon size={80} color="#8B5CF6" />
            </View>
            <TaskInput
              value={input}
              onChangeText={setInput}
              onSubmit={handleBreakTask}
              isLoading={isLoading}
            />
          </View>
        </ScrollView>

        {/* Native Ad at bottom - Fixed position, responsive with safe area */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <NativeAdCard showAd={true} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWidget: {
    position: 'absolute',
    right: 16,
    zIndex: 100,
  },
});
