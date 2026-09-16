import type { BreakdownContent, TaskBreakdown } from '../../repositories/taskRepository';

export type FocusLaunchOptions = {
  taskId?: string;
  resumeStepIndex?: number;
  requestId?: string;
};

/** The focus route for a breakdown. Shared by every screen that can start one. */
export function focusRoute(
  content: BreakdownContent,
  { taskId, resumeStepIndex, requestId }: FocusLaunchOptions = {}
) {
  return {
    pathname: '/focus' as const,
    params: {
      steps: JSON.stringify(content.steps),
      input: content.title,
      empathyBridge: content.empathyBridge ?? '',
      firstStepHook: content.firstStepHook ?? '',
      ...(content.stoppingPoint ? { stoppingPoint: content.stoppingPoint } : {}),
      ...(requestId ? { requestId } : {}),
      ...(taskId ? { taskId } : {}),
      ...(resumeStepIndex !== undefined ? { resumeStepIndex: String(resumeStepIndex) } : {}),
    },
  };
}

/**
 * How a saved breakdown reopens. A finished one replays from the start and leaves its recorded
 * progress alone; an unfinished one picks up at the first step not yet done.
 */
export function historyRoute(item: TaskBreakdown) {
  if (item.completedAt !== null) {
    return focusRoute(item);
  }
  const resumeStepIndex =
    item.completedStepCount > 0
      ? Math.min(item.completedStepCount, item.steps.length - 1)
      : undefined;
  return focusRoute(item, { taskId: item.id, resumeStepIndex });
}
