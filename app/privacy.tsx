import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../src/features/auth/controller/AuthContext';
import { deleteUserAccount, exportUserData } from '../src/lib/api/userData';
import { clearPlannerState } from '../src/features/planner/plannerStorage';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useDialog } from '../src/components/feedback/Dialog';
import { haptics } from '../src/lib/ui/haptics';
import { PRESS_SPRING } from '../src/lib/ui/motion';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

/** One button style for the whole screen. Declared here, not in render, so its press
 * animation keeps its state between renders. */
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
  const scale = useSharedValue(1);
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const bgColor =
    variant === 'danger' ? 'bg-red-600' : variant === 'secondary' ? 'bg-gray-800' : 'bg-primary';

  return (
    <AnimatedTouchableOpacity
      onPressIn={() => {
        scale.value = withSpring(0.96, PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      onPress={onPress}
      disabled={disabled || loading}
      className={`${bgColor} rounded-xl py-4 px-6 mb-4`}
      style={buttonStyle}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color="white" />
      ) : (
        <Text className="text-white text-center font-semibold text-lg">{title}</Text>
      )}
    </AnimatedTouchableOpacity>
  );
};

export { RouteErrorBoundary as ErrorBoundary } from '../src/components/feedback/RouteErrorBoundary';

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dialog = useDialog();
  const { user, signOut } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExportData = async () => {
    if (!user) {
      await dialog.alert({ title: t('common.error'), message: t('errors.exportFailed') });
      return;
    }

    try {
      setExporting(true);
      haptics.press();

      const data = await exportUserData();

      const exportFile = new File(Paths.cache, `minito-export-${Date.now()}.json`);
      exportFile.create();
      exportFile.write(JSON.stringify(data, null, 2));

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(exportFile.uri);
        haptics.success();
        await dialog.alert({
          title: t('common.success'),
          message: t('privacy.exportData.success', {
            defaultValue: 'Your data has been exported and is ready to share',
          }),
        });
      } else {
        await dialog.alert({ title: t('common.error'), message: t('errors.exportFailed') });
      }
    } catch (error) {
      console.error('Export error:', error);
      haptics.error();
      await dialog.alert({ title: t('common.error'), message: t('errors.exportFailed') });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) {
      await dialog.alert({ title: t('common.error'), message: t('errors.deleteFailed') });
      return;
    }

    const confirmed = await dialog.confirm({
      title: t('privacy.deleteAccount.confirmTitle'),
      message: t('privacy.deleteAccount.confirmMessage'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;

    try {
      setDeleting(true);
      haptics.commit();

      const deletedUserId = user.id;
      await deleteUserAccount();
      // The server copy is gone; the device copy of the planner goes with it.
      await clearPlannerState(deletedUserId);
      await signOut();

      haptics.success();
      await dialog.alert({
        title: t('common.success'),
        message: t('privacy.deleteAccount.success', {
          defaultValue: 'Your account has been deleted',
        }),
      });
      router.replace('/');
    } catch (error) {
      console.error('Delete error:', error);
      haptics.error();
      await dialog.alert({ title: t('common.error'), message: t('errors.deleteFailed') });
    } finally {
      setDeleting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      haptics.press();
      await signOut();
      router.replace('/');
    } catch (error) {
      console.error('Sign out error:', error);
      await dialog.alert({ title: t('common.error'), message: t('errors.signOutFailed') });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <StatusBar barStyle="light-content" />

      <View className="flex-row items-center px-2 pt-2">
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          className="w-11 h-11 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1">
        <View className="flex-1 px-6 pb-8 pt-2">
          <Text className="text-textMain text-3xl font-bold mb-2">{t('privacy.title')}</Text>
          <Text className="text-textMuted text-base mb-8">{t('privacy.subtitle')}</Text>

          {/* User Info */}
          {user && (
            <View className="bg-surface rounded-2xl p-6 mb-6">
              <Text className="text-textMuted text-sm mb-2">{t('privacy.signedInAs')}</Text>
              <Text className="text-textMain text-lg font-semibold mb-1">
                {user.email || 'User'}
              </Text>
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
                onPress={() => void handleExportData()}
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
                onPress={() => void handleDeleteAccount()}
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
              <Button
                onPress={() => void handleSignOut()}
                title={t('privacy.signOut')}
                variant="secondary"
              />
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
    </SafeAreaView>
  );
}
