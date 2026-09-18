import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CloudOff, Sparkles } from 'lucide-react-native';
import { EmptyState } from '../src/components/feedback/EmptyState';
import { useTaskHistory } from '../src/features/tasks/controller/useTaskHistory';
import { historyRoute } from '../src/features/tasks/focusLaunch';
import { confirmDeleteBreakdown } from '../src/features/tasks/ui/confirmDeleteBreakdown';
import { TaskHistoryRow, useRelativeTime } from '../src/features/tasks/ui/TaskHistoryList';
import type { TaskBreakdown } from '../src/repositories/taskRepository';
import { useDialog } from '../src/components/feedback/Dialog';
import { haptics } from '../src/lib/ui/haptics';

export { RouteErrorBoundary as ErrorBoundary } from '../src/components/feedback/RouteErrorBoundary';

/** Every saved breakdown, newest first, loaded a page at a time. */
export default function HistoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const dialog = useDialog();
  const insets = useSafeAreaInsets();
  const formatTime = useRelativeTime();
  const {
    items,
    status,
    isLoadingMore,
    loadMoreFailed,
    isRefreshing,
    reload,
    refresh,
    loadMore,
    remove,
  } = useTaskHistory();

  // Progress changes while a task is open in focus mode, so the list reloads on every return.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const handleOpen = useCallback(
    (item: TaskBreakdown) => {
      haptics.selection();
      router.push(historyRoute(item));
    },
    [router]
  );

  const handleDelete = useCallback(
    (item: TaskBreakdown) => void confirmDeleteBreakdown(t, dialog, () => remove(item.id)),
    [t, dialog, remove]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: TaskBreakdown; index: number }) => (
      <View style={index > 0 ? styles.divider : undefined}>
        <TaskHistoryRow
          item={item}
          timeLabel={formatTime(item.createdAt)}
          onOpen={handleOpen}
          onDelete={handleDelete}
        />
      </View>
    ),
    [formatTime, handleOpen, handleDelete]
  );

  const renderEmpty = () => {
    if (status === 'loading') {
      return <ActivityIndicator color="#A78BFA" style={styles.loading} />;
    }
    if (status === 'error' || status === 'unavailable') {
      return (
        <EmptyState
          icon={CloudOff}
          title={t('tasks.syncError')}
          description={t('tasks.historyUnavailable')}
          action={{ label: t('tasks.retry'), onPress: () => void refresh() }}
        />
      );
    }
    return (
      <EmptyState icon={Sparkles} title={t('tasks.emptyTitle')} description={t('tasks.empty')} />
    );
  };

  const renderFooter = () => {
    if (isLoadingMore) {
      return <ActivityIndicator color="#A78BFA" style={styles.footer} />;
    }
    if (loadMoreFailed) {
      return (
        <TouchableOpacity
          onPress={() => void loadMore()}
          style={styles.footer}
          accessibilityRole="button"
        >
          <Text style={styles.footerText}>{t('tasks.loadMoreFailed')}</Text>
          <Text style={styles.footerAction}>{t('tasks.retry')}</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('tasks.historyTitle')}</Text>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refresh()}
            tintColor="#A78BFA"
            colors={['#8B5CF6']}
            progressBackgroundColor="#1E1E2E"
          />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 96 },
          items.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
      />
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
  listContent: {
    paddingHorizontal: 20,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  loading: {
    marginTop: 48,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  footerAction: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#A78BFA',
  },
});
