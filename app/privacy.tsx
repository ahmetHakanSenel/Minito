import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../src/features/auth/controller/AuthContext';
import { deleteUserAccount, exportUserData } from '../src/lib/api/userData';
import { LanguageSelector } from '../src/components';
import * as Haptics from 'expo-haptics';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export { RouteErrorBoundary as ErrorBoundary } from '../src/components/feedback/RouteErrorBoundary';

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExportData = async () => {
    if (!user) {
      Alert.alert(t('common.error'), t('errors.exportFailed'));
      return;
    }

    try {
      setExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const data = await exportUserData();

      const exportFile = new File(Paths.cache, `minito-export-${Date.now()}.json`);
      exportFile.create();
      exportFile.write(JSON.stringify(data, null, 2));

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(exportFile.uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          t('common.success'),
          t('privacy.exportData.success', {
            defaultValue: 'Your data has been exported and is ready to share',
          })
        );
      } else {
        Alert.alert(t('common.error'), t('errors.exportFailed'));
      }
    } catch (error: any) {
      console.error('Export error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), error.message || t('errors.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = () => {
    if (!user) {
      Alert.alert(t('common.error'), t('errors.deleteFailed'));
      return;
    }

    Alert.alert(
      t('privacy.deleteAccount.confirmTitle'),
      t('privacy.deleteAccount.confirmMessage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

              await deleteUserAccount();
              await signOut();

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                t('common.success'),
                t('privacy.deleteAccount.success', {
                  defaultValue: 'Your account has been deleted',
                }),
                [
                  {
                    text: t('common.confirm'),
                    onPress: () => router.replace('/'),
                  },
                ]
              );
            } catch (error: any) {
              console.error('Delete error:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(t('common.error'), error.message || t('errors.deleteFailed'));
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await signOut();
      router.replace('/');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('errors.signOutFailed'));
    }
  };

  const Button = ({
    onPress,
    title,
    variant = 'primary',
    loading = false,
    disabled = false,
  }: {
    onPress: () => void;
    title: string;
    variant?: 'primary' | 'danger' | 'secondary';
    loading?: boolean;
    disabled?: boolean;
  }) => {
    const pressed = useSharedValue(0);
    const buttonStyle = useAnimatedStyle(() => ({
      transform: [{ scale: withSpring(pressed.value ? 0.96 : 1, { damping: 10, stiffness: 200 }) }],
    }));

    const bgColor =
      variant === 'danger' ? 'bg-red-600' : variant === 'secondary' ? 'bg-gray-800' : 'bg-primary';

    return (
      <AnimatedTouchableOpacity
        onPressIn={() => (pressed.value = 1)}
        onPressOut={() => (pressed.value = 0)}
        onPress={onPress}
        disabled={disabled || loading}
        className={`${bgColor} rounded-xl py-4 px-6 mb-4`}
        style={buttonStyle}
      >
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text className="text-white text-center font-semibold text-lg">{title}</Text>
        )}
      </AnimatedTouchableOpacity>
    );
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      <View className="flex-1 px-6 py-8">
        <Text className="text-textMain text-3xl font-bold mb-2">{t('privacy.title')}</Text>
        <Text className="text-textMuted text-base mb-8">{t('privacy.subtitle')}</Text>

        {/* Language Selector */}
        <View className="bg-surface rounded-2xl p-6 mb-6">
          <LanguageSelector />
        </View>

        {/* User Info */}
        {user && (
          <View className="bg-surface rounded-2xl p-6 mb-6">
            <Text className="text-textMuted text-sm mb-2">{t('privacy.signedInAs')}</Text>
            <Text className="text-textMain text-lg font-semibold mb-1">{user.email || 'User'}</Text>
            <Text className="text-textMuted text-xs">
              {t('privacy.userId')}: {user.id.substring(0, 8)}...
            </Text>
          </View>
        )}

        {/* GDPR Section */}
        <View className="mb-8">
          <Text className="text-textMain text-xl font-semibold mb-4">{t('privacy.gdpr')}</Text>

          <View className="bg-surface rounded-2xl p-6 mb-4">
            <Text className="text-textMain text-base font-medium mb-2">
              {t('privacy.exportData.title')}
            </Text>
            <Text className="text-textMuted text-sm mb-4">
              {t('privacy.exportData.description')}
            </Text>
            <Button
              onPress={handleExportData}
              title={t('privacy.exportData.button')}
              variant="secondary"
              loading={exporting}
              disabled={!user}
            />
          </View>

          <View className="bg-surface rounded-2xl p-6">
            <Text className="text-textMain text-base font-medium mb-2">
              {t('privacy.deleteAccount.title')}
            </Text>
            <Text className="text-textMuted text-sm mb-4">
              {t('privacy.deleteAccount.description')}
            </Text>
            <Button
              onPress={handleDeleteAccount}
              title={t('privacy.deleteAccount.button')}
              variant="danger"
              loading={deleting}
              disabled={!user}
            />
          </View>
        </View>

        {/* Sign Out */}
        {user && (
          <View className="mb-8">
            <Button onPress={handleSignOut} title={t('privacy.signOut')} variant="secondary" />
          </View>
        )}

        {/* Privacy Notice */}
        <View className="bg-surface/50 rounded-2xl p-6">
          <Text className="text-textMuted text-xs leading-5">
            <Text className="font-semibold">{t('privacy.privacyNotice.title')}</Text>{' '}
            {t('privacy.privacyNotice.text')}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
