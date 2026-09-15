import { useCallback, useState } from 'react';
import {
  taskRepository,
  TaskRepositoryError,
  type BreakdownOutcome,
  type TaskBreakdown,
} from '../../../repositories/taskRepository';

const RECENT_LIMIT = 8;

export type HistoryStatus = 'loading' | 'ready' | 'error' | 'unavailable';

export function useTaskBreakdowns() {
  const [items, setItems] = useState<TaskBreakdown[]>([]);
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>('loading');
  const [isBreakingDown, setIsBreakingDown] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setItems(await taskRepository.listRecent(RECENT_LIMIT));
      setHistoryStatus('ready');
    } catch (error) {
      const isUnavailable = error instanceof TaskRepositoryError && error.code === 'unavailable';
      setHistoryStatus(isUnavailable ? 'unavailable' : 'error');
    }
  }, []);

  const breakDown = useCallback(async (input: string): Promise<BreakdownOutcome> => {
    setIsBreakingDown(true);
    try {
      const outcome = await taskRepository.breakDown(input);
      if (outcome.status === 'ready' && outcome.saved) {
        const saved = outcome.saved;
        setItems((current) => [saved, ...current].slice(0, RECENT_LIMIT));
        setHistoryStatus('ready');
      }
      return outcome;
    } finally {
      setIsBreakingDown(false);
    }
  }, []);

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
    },
    [items]
  );

  return { items, historyStatus, isBreakingDown, refresh, breakDown, remove };
}
