import React, { useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ChevronRight, Sparkles } from 'lucide-react-native';
import { EmptyState } from '../../../components/feedback/EmptyState';
import type { TaskBreakdown } from '../../../repositories/taskRepository';
import type { HistoryStatus } from '../controller/useTaskBreakdowns';
import { relativeTime } from '../../../lib/time/relativeTime';

/** "just now", "5 min ago" … then a locale date once it is over a week old. */
export function useRelativeTime() {
  const { t, i18n } = useTranslation();
  return useCallback(
    (iso: string) => {
      const ago = relativeTime(Date.now() - new Date(iso).getTime());
      switch (ago.unit) {
        case 'justNow':
          return t('tasks.time.justNow');
        case 'minutes':
          return t('tasks.time.minutesAgo', { count: ago.count });
        case 'hours':
          return t('tasks.time.hoursAgo', { count: ago.count });
        case 'days':
          return t('tasks.time.daysAgo', { count: ago.count });
        default:
          return new Date(iso).toLocaleDateString(i18n.language);
      }
    },
    [t, i18n.language]
  );
}

type TaskHistoryRowProps = {
  item: TaskBreakdown;
  timeLabel: string;
  onOpen: (item: TaskBreakdown) => void;
  onDelete: (item: TaskBreakdown) => void;
};

export function TaskHistoryRow({ item, timeLabel, onOpen, onDelete }: TaskHistoryRowProps) {
  const { t } = useTranslation();
  const total = item.steps.length;
  const isCompleted = item.completedAt !== null;
  const done = isCompleted ? total : Math.min(item.completedStepCount, total);
  const progress = total > 0 ? done / total : 0;

  return (
    <TouchableOpacity
      onPress={() => onOpen(item)}
      onLongPress={() => onDelete(item)}
      delayLongPress={350}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityHint={t('tasks.longPressHint')}
      className="flex-row items-center py-3.5"
    >
      <View className="flex-1 mr-3">
        <Text className="text-textMain text-[15px] font-medium" numberOfLines={1}>
          {item.title}
        </Text>
        <View className="flex-row items-center mt-1.5">
          {isCompleted ? (
            <>
              <CheckCircle2 size={13} color="#34D399" strokeWidth={2.25} />
              <Text className="text-success text-xs font-medium ml-1">{t('tasks.completed')}</Text>
            </>
          ) : (
            <>
              <View className="h-1 w-10 rounded-full bg-white/10 overflow-hidden">
                <View
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${progress * 100}%` }}
                />
              </View>
              <Text className="text-textMuted text-xs ml-2">
                {t('tasks.stepsProgress', { done, total })}
              </Text>
            </>
          )}
          <Text className="text-textMuted text-xs">{`  ·  ${timeLabel}`}</Text>
        </View>
      </View>
      <ChevronRight size={16} color="#52525B" strokeWidth={2} />
    </TouchableOpacity>
  );
}

type TaskHistoryListProps = {
  items: TaskBreakdown[];
  status: HistoryStatus;
  /** Older breakdowns exist beyond the ones shown here. */
  hasMore: boolean;
  onOpen: (item: TaskBreakdown) => void;
  onDelete: (item: TaskBreakdown) => void;
  onRetry: () => void;
  onSeeAll: () => void;
};

/** The home screen's short list: the latest few, and the way into the full history. */
export function TaskHistoryList({
  items,
  status,
  hasMore,
  onOpen,
  onDelete,
  onRetry,
  onSeeAll,
}: TaskHistoryListProps) {
  const { t } = useTranslation();
  const formatTime = useRelativeTime();

  // Without the backing table there is no history to show; the breakdown flow still works.
  if (status === 'unavailable') {
    return null;
  }

  const renderBody = () => {
    if (items.length > 0) {
      return items.map((item, index) => (
        <View key={item.id} className={index > 0 ? 'border-t border-white/5' : undefined}>
          <TaskHistoryRow
            item={item}
            timeLabel={formatTime(item.createdAt)}
            onOpen={onOpen}
            onDelete={onDelete}
          />
        </View>
      ));
    }
    if (status === 'loading') {
      return (
        <>
          <View className="h-11 rounded-xl bg-white/5 mt-3" />
          <View className="h-11 rounded-xl bg-white/5 mt-2 opacity-60" />
        </>
      );
    }
    if (status === 'error') {
      return (
        <View className="flex-row items-center justify-between py-3">
          <Text className="text-textMuted text-sm">{t('tasks.syncError')}</Text>
          <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-primary text-sm font-semibold">{t('tasks.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <EmptyState
        compact
        icon={Sparkles}
        title={t('tasks.emptyTitle')}
        description={t('tasks.empty')}
      />
    );
  };

  return (
    <View className="px-4 mt-7">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-textMuted text-[11px] font-semibold uppercase tracking-widest">
          {t('tasks.recentTitle')}
        </Text>
        {hasMore ? (
          <TouchableOpacity
            onPress={onSeeAll}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="link"
            className="flex-row items-center"
          >
            <Text className="text-primary text-xs font-semibold">{t('tasks.seeAll')}</Text>
            <ChevronRight size={14} color="#8B5CF6" strokeWidth={2.25} />
          </TouchableOpacity>
        ) : null}
      </View>
      {renderBody()}
    </View>
  );
}
