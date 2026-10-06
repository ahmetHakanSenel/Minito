import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { haptics } from '../../../lib/ui/haptics';
import type { HealthSnapshot } from '../controller/useSystemHealth';

type ServiceNoticeProps = {
  snapshot: HealthSnapshot | null;
  isChecking: boolean;
  onRetry: () => void;
};

// Health stays invisible while things work; users only hear about outages they would feel.
// Slowness alone is not surfaced because there is nothing the user can do about it.
function problemMessageKey(snapshot: HealthSnapshot | null): string | null {
  if (snapshot?.api.state === 'down') {
    return 'health.backendDown';
  }
  if (snapshot?.ai.state === 'down') {
    return 'health.aiDown';
  }
  return null;
}

export function ServiceNotice({ snapshot, isChecking, onRetry }: ServiceNoticeProps) {
  const { t } = useTranslation();
  const messageKey = problemMessageKey(snapshot);

  if (!messageKey) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      style={styles.container}
      accessibilityRole="alert"
    >
      <AlertTriangle size={18} color="#FBBF24" strokeWidth={2} />
      <Text style={styles.message}>{t(messageKey)}</Text>
      <TouchableOpacity
        onPress={() => {
          haptics.tap();
          onRetry();
        }}
        disabled={isChecking}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
      >
        <Text style={[styles.retry, isChecking && styles.retryBusy]}>{t('health.retry')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  message: {
    flex: 1,
    color: '#FDE68A',
    fontSize: 13,
    lineHeight: 19,
  },
  retry: {
    color: '#FBBF24',
    fontSize: 13,
    fontWeight: '600',
  },
  retryBusy: {
    opacity: 0.5,
  },
});
