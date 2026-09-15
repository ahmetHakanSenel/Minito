import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Calendar, Headphones, BarChart3, Settings, Crown, User } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/controller/AuthContext';

const { width } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_SIZE = (width - 40 - CARD_GAP) / 2;

interface DashboardModalProps {
  visible: boolean;
  onClose: () => void;
  userName?: string;
  isPremium?: boolean;
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.actionCard, { backgroundColor: bgColor }]}
      onPress={handlePress}
      activeOpacity={0.8}
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
  isPremium = false,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const { displayName, user } = useAuth();
  // Screens that do not pass a name still show the signed-in user's handle.
  const name = userName ?? displayName ?? user?.email ?? t('dashboard.guest');

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <AnimatedView
            entering={SlideInDown.duration(300).damping(20)}
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
                  <Text style={styles.userName}>{name}</Text>
                  {isPremium ? (
                    <LinearGradient
                      colors={['#F59E0B', '#D97706']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.premiumBadge}
                    >
                      <Crown size={12} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.premiumText}>{t('dashboard.premiumPlan')}</Text>
                    </LinearGradient>
                  ) : (
                    <Text style={styles.freeText}>{t('dashboard.freePlan')}</Text>
                  )}
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
      </AnimatedView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
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
    paddingTop: 60,
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
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  premiumText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  freeText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
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
    width: CARD_SIZE,
    aspectRatio: 1,
    borderRadius: 24,
    padding: 20,
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
