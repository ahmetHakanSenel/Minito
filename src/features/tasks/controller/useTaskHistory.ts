import { useCallback, useRef, useState } from 'react';
import { taskRepository, type TaskBreakdown } from '../../../repositories/taskRepository';
import { historyStatusFor, type HistoryStatus } from './useTaskBreakdowns';

const PAGE_SIZE = 20;

// A breakdown created while paging shifts every offset by one, which would repeat a row at the
// page boundary. Dropping ids already shown keeps the list clean without cursor pagination.
function appendUnique(current: TaskBreakdown[], page: TaskBreakdown[]): TaskBreakdown[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...page.filter((item) => !seen.has(item.id))];
}

/** The full history, loaded a page at a time as the list scrolls. */
export function useTaskHistory() {
  const [items, setItems] = useState<TaskBreakdown[]>([]);
  const [status, setStatus] = useState<HistoryStatus>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Guards against onEndReached firing again before the previous page has arrived.
  const pagingRef = useRef(false);

  const fetchPage = useCallback(async (offset: number) => {
    const rows = await taskRepository.listPage({ offset, limit: PAGE_SIZE + 1 });
    return { rows: rows.slice(0, PAGE_SIZE), more: rows.length > PAGE_SIZE };
  }, []);

  const reload = useCallback(async () => {
    try {
      const { rows, more } = await fetchPage(0);
      setItems(rows);
      setHasMore(more);
      setLoadMoreFailed(false);
      setStatus('ready');
    } catch (error) {
      setStatus(historyStatusFor(error));
    }
  }, [fetchPage]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await reload();
    } finally {
      setIsRefreshing(false);
    }
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (pagingRef.current || !hasMore || status !== 'ready') return;
    pagingRef.current = true;
    setIsLoadingMore(true);
    try {
      const { rows, more } = await fetchPage(items.length);
      setItems((current) => appendUnique(current, rows));
      setHasMore(more);
      setLoadMoreFailed(false);
    } catch {
      // The rows already shown stay; the footer offers a retry.
      setLoadMoreFailed(true);
    } finally {
      pagingRef.current = false;
      setIsLoadingMore(false);
    }
  }, [fetchPage, hasMore, status, items.length]);

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

  return {
    items,
    status,
    hasMore,
    isLoadingMore,
    loadMoreFailed,
    isRefreshing,
    reload,
    refresh,
    loadMore,
    remove,
  };
}
