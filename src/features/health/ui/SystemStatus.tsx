import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ChevronRight,
  Cloud,
  Cpu,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react-native';
import Animated, {
  Easing,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { haptics } from '../../../lib/ui/haptics';
import type { HistoryStatus } from '../../tasks/controller/useTaskBreakdowns';
import type { HealthSnapshot } from '../controller/useSystemHealth';

type Tone = 'operational' | 'degraded' | 'down' | 'checking' | 'unconfigured';

const TONE_COLORS: Record<Tone, string> = {
  operational: '#34D399',
  degraded: '#FBBF24',
  down: '#F87171',
  checking: '#A1A1AA',
  unconfigured: '#71717A',
};

const SYNC_TONES: Record<HistoryStatus, Tone> = {
  ready: 'operational',
  loading: 'checking',
  error: 'degraded',
  unavailable: 'unconfigured',
};

const MONOSPACE = Platform.select({ ios: 'Menlo', default: 'monospace' });

function overallStatus(
  snapshot: HealthSnapshot | null,
  syncTone: Tone
): { tone: Tone; labelKey: string } {
  if (!snapshot) {
    return { tone: 'checking', labelKey: 'health.checking' };
  }
  if (snapshot.api.state === 'unconfigured') {
    return { tone: 'unconfigured', labelKey: 'health.offline' };
  }
  const tones: Tone[] = [snapshot.api.state, snapshot.ai.state, syncTone];
  if (tones.includes('down')) {
    return { tone: 'down', labelKey: 'health.disruption' };
  }
  if (tones.includes('degraded')) {
    return { tone: 'degraded', labelKey: 'health.degraded' };
  }
  return { tone: 'operational', labelKey: 'health.operational' };
}

function StatusDot({ tone, size = 8 }: { tone: Tone; size?: number }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.6 }],
  }));

  const dotStyle = { borderRadius: size / 2, backgroundColor: TONE_COLORS[tone] };

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, dotStyle, haloStyle]} />
      <View style={[StyleSheet.absoluteFill, dotStyle]} />
    </View>
  );
}

type ServiceRowProps = {
  icon: LucideIcon;
  title: string;
  detail: string;
  tone: Tone;
  latencyMs: number | null;
};

function ServiceRow({ icon: Icon, title, detail, tone, latencyMs }: ServiceRowProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon size={18} color="#C4B5FD" strokeWidth={2} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <View style={styles.rowStatus}>
        <View style={styles.rowStateLine}>
          <StatusDot tone={tone} size={7} />
          <Text style={[styles.rowState, { color: TONE_COLORS[tone] }]}>
            {t(`health.state.${tone}`)}
          </Text>
        </View>
        {latencyMs !== null && <Text style={styles.rowLatency}>{latencyMs} ms</Text>}
      </View>
    </View>
  );
}

type SystemStatusPillProps = {
  snapshot: HealthSnapshot | null;
  isChecking: boolean;
  syncStatus: HistoryStatus;
  onRefresh: () => void;
};

export function SystemStatusPill({
  snapshot,
  isChecking,
  syncStatus,
  onRefresh,
}: SystemStatusPillProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);

  const syncTone = SYNC_TONES[syncStatus];
  const overall = overallStatus(snapshot, syncTone);
  const sessionTone: Tone = snapshot?.api.state === 'unconfigured' ? 'unconfigured' : 'operational';
  const checkedAt = snapshot?.checkedAt.toLocaleTimeString(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const open = () => {
    haptics.tap();
    setIsOpen(true);
    onRefresh();
  };

  const close = () => setIsOpen(false);

  return (
    <>
      <TouchableOpacity
        style={styles.pill}
        onPress={open}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t(overall.labelKey)}
      >
        <StatusDot tone={overall.tone} />
        <Text style={styles.pillText}>{t(overall.labelKey)}</Text>
        <ChevronRight size={14} color="rgba(255, 255, 255, 0.4)" strokeWidth={2} />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close} />
        <Animated.View
          entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(200)}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Activity size={18} color="#A78BFA" strokeWidth={2} />
            <Text style={styles.sheetTitle}>{t('health.title')}</Text>
          </View>
          <Text style={styles.sheetSubtitle}>{t('health.subtitle')}</Text>

          <ServiceRow
            icon={Cloud}
            title={t('health.api')}
            detail={t('health.apiDetail')}
            tone={snapshot?.api.state ?? 'checking'}
            latencyMs={snapshot?.api.latencyMs ?? null}
          />
          <ServiceRow
            icon={Cpu}
            title={t('health.ai')}
            detail={t('health.aiDetail')}
            tone={snapshot?.ai.state ?? 'checking'}
            latencyMs={snapshot?.ai.latencyMs ?? null}
          />
          <ServiceRow
            icon={RefreshCw}
            title={t('health.sync')}
            detail={t('health.syncDetail')}
            tone={syncTone}
            latencyMs={null}
          />
          <ServiceRow
            icon={ShieldCheck}
            title={t('health.session')}
            detail={t('health.sessionDetail')}
            tone={sessionTone}
            latencyMs={null}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {checkedAt ? t('health.lastChecked', { time: checkedAt }) : t('health.checking')}
            </Text>
            <TouchableOpacity
              onPress={() => {
                haptics.selection();
                onRefresh();
              }}
              disabled={isChecking}
              style={[styles.refreshButton, isChecking && styles.refreshButtonBusy]}
              accessibilityRole="button"
            >
              <RefreshCw size={14} color="#E5E5E5" strokeWidth={2.25} />
              <Text style={styles.refreshText}>
                {isChecking ? t('health.state.checking') : t('health.refresh')}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pillText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#12121C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  sheetSubtitle: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    marginRight: 12,
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  rowDetail: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    marginTop: 2,
  },
  rowStatus: {
    alignItems: 'flex-end',
  },
  rowStateLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowState: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowLatency: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    fontFamily: MONOSPACE,
    marginTop: 3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  refreshButtonBusy: {
    opacity: 0.6,
  },
  refreshText: {
    color: '#E5E5E5',
    fontSize: 13,
    fontWeight: '500',
  },
});
