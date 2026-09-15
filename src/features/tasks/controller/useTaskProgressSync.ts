import { useCallback, useRef } from 'react';
import { taskRepository } from '../../../repositories/taskRepository';

// Best-effort sync: the focus flow must never stall or fail because of the network.
export function useTaskProgressSync(taskId: string | undefined, initialCompletedCount: number) {
  const lastSynced = useRef(initialCompletedCount);

  const syncProgress = useCallback(
    (completedCount: number) => {
      if (!taskId || completedCount <= lastSynced.current) {
        return;
      }
      lastSynced.current = completedCount;
      taskRepository
        .recordProgress(taskId, completedCount)
        .catch((error) => console.warn('Failed to sync task progress:', error));
    },
    [taskId]
  );

  const markCompleted = useCallback(
    (totalSteps: number) => {
      if (!taskId) {
        return;
      }
      lastSynced.current = totalSteps;
      taskRepository
        .markCompleted(taskId, totalSteps)
        .catch((error) => console.warn('Failed to mark task completed:', error));
    },
    [taskId]
  );

  return { syncProgress, markCompleted };
}
