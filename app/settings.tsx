import React from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Globe,
  HelpCircle,
  LogOut,
  Shield,
  Volume2,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../src/features/auth/controller/AuthContext';
import { SUPPORTED_LANGUAGES } from '../src/lib/i18n';
import { useChangeLanguage } from '../src/lib/i18n/I18nProvider';
import { haptics } from '../src/lib/ui/haptics';

const AnimatedView = Animated.createAnimatedComponent(View);

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'EN',
  tr: 'TR',
};

type SettingRowProps = {
  icon: React.ReactNode;
  label: string;
  index: number;
  onPress?: () => void;
  /** Not built yet: shown honestly as disabled instead of a control that does nothing. */
  comingSoon?: boolean;
  danger?: boolean;
};

function SettingRow({
  icon,
  label,
  index,
  onPress,
  comingSoon = false,
  danger = false,
}: SettingRowProps) {
  const { t } = useTranslation();
  const isInteractive = Boolean(onPress) && !comingSoon;

  return (
    <AnimatedView entering={FadeInDown.delay(index * 50).duration(250)}>
      <TouchableOpacity
        style={[styles.settingItem, comingSoon && styles.settingItemMuted]}
        onPress={() => {
          haptics.tap();
          onPress?.();
        }}
        disabled={!isInteractive}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ disabled: !isInteractive }}
      >
        <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>{icon}</View>
        <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>{label}</Text>
        {comingSoon ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t('settings.comingSoon')}</Text>
          </View>
        ) : (
          !danger && <ChevronRight size={20} color="rgba(255,255,255,0.3)" />
        )}
      </TouchableOpacity>
    </AnimatedView>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from '../src/components/feedback/RouteErrorBoundary';

export default function SettingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { signOut } = useAuth();
  const { changeLanguage } = useChangeLanguage();
  const currentLanguage = (i18n.language || 'en').split('-')[0];
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const handleBack = () => {
    haptics.tap();
    // Navigate back to home and open DashboardModal (Control Center)
    router.replace({
      pathname: '/',
      params: { openDashboard: 'true' },
    });
  };

  const handleSignOut = () => {
    Alert.alert(t('settings.signOutConfirmTitle'), t('settings.signOutConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.signOut'),
        style: 'destructive',
        onPress: async () => {
          try {
            // Clears the encrypted session; the root auth guard then routes to /login.
            await signOut();
          } catch {
            haptics.error();
            Alert.alert(t('common.error'), t('errors.signOutFailed'));
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} accessibilityRole="button">
          <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>{t('settings.preferences')}</Text>
        <View style={styles.section}>
          <AnimatedView entering={FadeInDown.duration(250)}>
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Globe size={20} color="#F97316" strokeWidth={2} />
              </View>
              <Text style={styles.settingLabel}>{t('settings.language')}</Text>
              <View style={styles.segment}>
                {SUPPORTED_LANGUAGES.map((language) => {
                  const isActive = currentLanguage === language;
                  return (
                    <TouchableOpacity
                      key={language}
                      onPress={() => {
                        haptics.selection();
                        changeLanguage(language);
                      }}
                      style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                        {LANGUAGE_LABELS[language] ?? language}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </AnimatedView>
          <SettingRow
            icon={<Bell size={20} color="#60A5FA" strokeWidth={2} />}
            label={t('settings.notifications')}
            index={1}
            comingSoon
          />
          <SettingRow
            icon={<Volume2 size={20} color="#34D399" strokeWidth={2} />}
            label={t('settings.soundEffects')}
            index={2}
            comingSoon
          />
        </View>

        <Text style={styles.sectionTitle}>{t('settings.support')}</Text>
        <View style={styles.section}>
          <SettingRow
            icon={<Shield size={20} color="#9CA3AF" strokeWidth={2} />}
            label={t('settings.privacy')}
            onPress={() => router.push('/privacy')}
            index={3}
          />
          <SettingRow
            icon={<HelpCircle size={20} color="#9CA3AF" strokeWidth={2} />}
            label={t('settings.help')}
            index={4}
            comingSoon
          />
        </View>

        <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
        <View style={styles.section}>
          <SettingRow
            icon={<LogOut size={20} color="#EF4444" strokeWidth={2} />}
            label={t('settings.signOut')}
            onPress={handleSignOut}
            index={5}
            danger
          />
        </View>

        <Text style={styles.version}>{t('settings.version', { version })}</Text>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  settingItemMuted: {
    opacity: 0.55,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingIconDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  settingLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  settingLabelDanger: {
    color: '#EF4444',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  badgeText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  segmentButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  segmentText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  version: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.3)',
    textAlign: 'center',
    marginTop: 8,
  },
});
