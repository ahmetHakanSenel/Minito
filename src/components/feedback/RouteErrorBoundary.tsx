import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { AlertTriangle, RotateCcw } from 'lucide-react-native';
import i18n from '../../lib/i18n/config';
import { captureException } from '../../lib/monitoring/sentry';

// The boundary can render before (or because) i18n failed, so every label carries a fallback.
function label(key: string, fallback: string): string {
  return i18n.isInitialized ? i18n.t(key, { defaultValue: fallback }) : fallback;
}

export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <View style={styles.container}>
      <View style={styles.iconBadge}>
        <AlertTriangle size={28} color="#FBBF24" strokeWidth={2} />
      </View>
      <Text style={styles.title}>{label('errorBoundary.title', 'Something went wrong')}</Text>
      <Text style={styles.message}>
        {label(
          'errorBoundary.message',
          'This screen hit an unexpected error. It has been reported, and trying again usually helps.'
        )}
      </Text>
      {__DEV__ && (
        <Text style={styles.devDetails} numberOfLines={4}>
          {error.message}
        </Text>
      )}
      <TouchableOpacity
        style={styles.retryButton}
        onPress={retry}
        accessibilityRole="button"
        activeOpacity={0.85}
      >
        <RotateCcw size={16} color="#FFFFFF" strokeWidth={2.25} />
        <Text style={styles.retryText}>{label('errorBoundary.retry', 'Try again')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#050510',
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    marginBottom: 16,
  },
  title: {
    color: '#E5E5E5',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#A1A1AA',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 320,
  },
  devDetails: {
    color: '#F87171',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8B5CF6',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 24,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
