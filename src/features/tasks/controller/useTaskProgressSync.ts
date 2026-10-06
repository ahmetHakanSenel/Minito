import { useCallback, useRef } from 'react';
import { taskRepository } from '../../../repositories/taskRepository';

/**
 * Best-effort sync: the focus flow must never stall or fail because of the network.
 *
 * `lastSynced` is what the server is known to have, so it moves only once a write has landed.
 * Moving it when the write was sent meant a write lost to a dead connection — the normal state of
 * a phone someone has left to go and do the step — was never sent again. Sending the same count
 * twice is harmless, because the repository only ever moves progress forward.
 */
export function useTaskProgressSync(taskId: string | undefined, initialCompletedCount: number) {
  const lastSynced = useRef(initialCompletedCount);

  const syncProgress = useCallback(
    (completedCount: number) => {
      if (!taskId || completedCount <= lastSynced.current) {
        return;
      }
      taskRepository
        .recordProgress(taskId, completedCount)
        .then(() => {
          lastSynced.current = Math.max(lastSynced.current, completedCount);
        })
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
