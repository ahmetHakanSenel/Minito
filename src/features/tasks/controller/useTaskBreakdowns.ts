import { useCallback, useState } from 'react';
import {
  taskRepository,
  TaskRepositoryError,
  type BreakdownOutcome,
  type TaskBreakdown,
} from '../../../repositories/taskRepository';

// The home screen is for starting something, not browsing: it shows the latest few and links to
// the full history.
const HOME_LIMIT = 3;

export type HistoryStatus = 'loading' | 'ready' | 'error' | 'unavailable';

export function historyStatusFor(error: unknown): HistoryStatus {
  return error instanceof TaskRepositoryError && error.code === 'unavailable'
    ? 'unavailable'
    : 'error';
}

export function useTaskBreakdowns() {
  const [items, setItems] = useState<TaskBreakdown[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>('loading');
  const [isBreakingDown, setIsBreakingDown] = useState(false);

  const refresh = useCallback(async () => {
    try {
      // One extra row answers "is there more?" without a separate count query.
      const rows = await taskRepository.listRecent(HOME_LIMIT + 1);
      setItems(rows.slice(0, HOME_LIMIT));
      setHasMore(rows.length > HOME_LIMIT);
      setHistoryStatus('ready');
    } catch (error) {
      setHistoryStatus(historyStatusFor(error));
    }
  }, []);

  const breakDown = useCallback(
    async (input: string): Promise<BreakdownOutcome> => {
      setIsBreakingDown(true);
      try {
        const outcome = await taskRepository.breakDown(input);
        if (outcome.status === 'ready' && outcome.saved) {
          const saved = outcome.saved;
          setItems((current) => [saved, ...current].slice(0, HOME_LIMIT));
          // A full list pushes its oldest entry into the history screen.
          setHasMore((more) => more || items.length >= HOME_LIMIT);
          setHistoryStatus('ready');
        }
        return outcome;
      } finally {
        setIsBreakingDown(false);
      }
    },
    [items.length]
  );

  const remove = useCallback(
    async (id: string) => {
      const previous = items;
      setItems(previous.filter((item) => item.id !== id));
      try {
        await taskRepository.remove(id);
      } catch (error) {
        setItems(previous);
        throw error;
      }
      // Refill the freed slot from the history behind it.
      void refresh();
    },
    [items, refresh]
  );

  return { items, hasMore, historyStatus, isBreakingDown, refresh, breakDown, remove };
}
