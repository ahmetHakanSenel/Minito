import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { haptics } from '../../lib/ui/haptics';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  /** Tighter spacing for empty states nested inside cards. */
  compact?: boolean;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.container, compact && styles.containerCompact]}
    >
      <View style={[styles.iconBadge, compact && styles.iconBadgeCompact]}>
        <Icon size={compact ? 20 : 26} color="#A78BFA" strokeWidth={1.75} />
      </View>
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action && (
        <TouchableOpacity
          style={styles.action}
          onPress={() => {
            haptics.tap();
            action.onPress();
          }}
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          <Text style={styles.actionText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  containerCompact: {
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    marginBottom: 16,
  },
  iconBadgeCompact: {
    width: 44,
    height: 44,
    borderRadius: 14,
    marginBottom: 12,
  },
  title: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  titleCompact: {
    fontSize: 15,
  },
  description: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 300,
  },
  action: {
    marginTop: 20,
    backgroundColor: '#8B5CF6',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
