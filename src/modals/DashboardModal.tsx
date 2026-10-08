import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { X, Calendar, Headphones, BarChart3, Settings, User } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/controller/AuthContext';
import { haptics } from '../lib/ui/haptics';

const CARD_GAP = 12;

interface DashboardModalProps {
  visible: boolean;
  onClose: () => void;
  userName?: string;
  onNavigate?: (screen: string) => void;
}

const AnimatedView = Animated.createAnimatedComponent(View);

interface QuickActionCardProps {
  icon: React.ReactNode;
  label: string;
  bgColor: string;
  onPress: () => void;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({ icon, label, bgColor, onPress }) => {
  const handlePress = () => {
    haptics.tap();
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.actionCard, { backgroundColor: bgColor }]}
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.actionIconContainer}>{icon}</View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

export const DashboardModal: React.FC<DashboardModalProps> = ({
  visible,
  onClose,
  userName,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const { displayName, user } = useAuth();

  // Screens that do not pass a name still show the signed-in user's handle.
  const name = userName ?? displayName ?? user?.email ?? t('dashboard.guest');
  // Only when it says something the name does not already.
  const subtitle = user?.email && user.email !== name ? user.email : null;

  const handleClose = () => {
    haptics.tap();
    onClose();
  };

  const handleNavigate = (screen: string) => {
    onNavigate?.(screen);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <AnimatedView
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={styles.overlay}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

        {/* A modal is a window of its own, laid out under a translucent status bar. Its safe area
            is measured there, by its own provider. Read from the app's root instead, the inset did
            not hold inside the modal, and the title was drawn under the status bar. */}
        <SafeAreaProvider>
          <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <AnimatedView
              entering={SlideInDown.duration(300)}
              exiting={SlideOutDown.duration(200)}
              style={styles.content}
            >
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('dashboard.controlCenter')}</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={handleClose}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                >
                  <X size={24} color="#FFFFFF" strokeWidth={2} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* User Summary Card */}
                <View style={styles.userCard}>
                  <View style={styles.avatarContainer}>
                    <User size={28} color="#FFFFFF" strokeWidth={2} />
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {name}
                    </Text>
                    {subtitle ? (
                      <Text style={styles.userSubtitle} numberOfLines={1}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Quick Actions Grid */}
                <Text style={styles.sectionTitle}>{t('dashboard.quickAccess')}</Text>
                <View style={styles.actionsGrid}>
                  <QuickActionCard
                    icon={<Calendar size={28} color="#60A5FA" strokeWidth={2} />}
                    label={t('planner.title')}
                    bgColor="rgba(96, 165, 250, 0.15)"
                    onPress={() => handleNavigate('planner')}
                  />
                  <QuickActionCard
                    icon={<Headphones size={28} color="#A78BFA" strokeWidth={2} />}
                    label={t('audio.title')}
                    bgColor="rgba(167, 139, 250, 0.15)"
                    onPress={() => handleNavigate('sounds')}
                  />
                  <QuickActionCard
                    icon={<BarChart3 size={28} color="#34D399" strokeWidth={2} />}
                    label={t('stats.title')}
                    bgColor="rgba(52, 211, 153, 0.15)"
                    onPress={() => handleNavigate('stats')}
                  />
                  <QuickActionCard
                    icon={<Settings size={28} color="#9CA3AF" strokeWidth={2} />}
                    label={t('settings.title')}
                    bgColor="rgba(156, 163, 175, 0.15)"
                    onPress={() => handleNavigate('settings')}
                  />
                </View>

                {/* Extra spacing at bottom */}
                <View style={{ height: 40 }} />
              </ScrollView>
            </AnimatedView>
          </SafeAreaView>
        </SafeAreaProvider>
      </AnimatedView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Android draws BlurView as a plain tint, not a blur, so at 0.85 the screen underneath stayed
  // readable through the translucent tiles and its words ran into theirs.
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 16, 0.96)',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  userSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  actionCard: {
    width: '48%',
    minHeight: 140,
    borderRadius: 24,
    padding: 16,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
