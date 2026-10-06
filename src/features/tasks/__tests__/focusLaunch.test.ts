import type { TaskBreakdown } from '../../../repositories/taskRepository';
import { focusRoute, historyRoute } from '../focusLaunch';

const step = (n: number) => ({
  id: `step-${n}`,
  title: `Step ${n}`,
  instruction: '',
  estimatedMinutes: null,
  difficulty: null,
});

const item: TaskBreakdown = {
  id: 'task-1',
  title: 'Clean the kitchen',
  empathyBridge: null,
  firstStepHook: 'Stand up.',
  stoppingPoint: 'You can stop here.',
  steps: [step(1), step(2), step(3)],
  completedStepCount: 0,
  completedAt: null,
  createdAt: '2026-09-16T10:00:00Z',
};

describe('focusRoute', () => {
  it('carries only the options that are set', () => {
    expect(focusRoute(item).params).toEqual({
      steps: JSON.stringify(item.steps),
      input: 'Clean the kitchen',
      empathyBridge: '',
      firstStepHook: 'Stand up.',
      stoppingPoint: 'You can stop here.',
    });
  });
});

describe('historyRoute', () => {
  it('starts an untouched task from the intro, tracked against its row', () => {
    const { params } = historyRoute(item);

    expect(params).toMatchObject({ taskId: 'task-1' });
    expect(params).not.toHaveProperty('resumeStepIndex');
  });

  it('resumes an unfinished task at the first open step', () => {
    expect(historyRoute({ ...item, completedStepCount: 2 }).params).toMatchObject({
      taskId: 'task-1',
      resumeStepIndex: '2',
    });
  });

  it('never resumes past the last step', () => {
    expect(historyRoute({ ...item, completedStepCount: 9 }).params).toMatchObject({
      resumeStepIndex: '2',
    });
  });

  it('replays a finished task without touching its saved progress', () => {
    const { params } = historyRoute({
      ...item,
      completedStepCount: 3,
      completedAt: '2026-09-16T11:00:00Z',
    });

    expect(params).not.toHaveProperty('taskId');
    expect(params).not.toHaveProperty('resumeStepIndex');
  });
});
