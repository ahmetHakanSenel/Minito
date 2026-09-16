import { getSupabase } from '../../data/supabase/client';
import { breakTask } from '../../lib/api/breakTask';
import type { BreakdownStep } from '../../lib/breakdownSteps';
import { FallbackReason } from '../../safety';
import { taskRepository } from '../taskRepository';

jest.mock('../../data/supabase/client', () => {
  const client = { from: jest.fn() };
  return { getSupabase: jest.fn(() => client) };
});
jest.mock('../../lib/api/breakTask', () => ({ breakTask: jest.fn() }));
jest.mock('../../lib/guestIdentity', () => ({
  getOrCreateGuestId: jest.fn(async () => 'guest-1'),
}));

const mockedFrom = jest.mocked(getSupabase().from);
const mockedGetSupabase = jest.mocked(getSupabase);
const mockedBreakTask = jest.mocked(breakTask);

type QueryResult = { data: unknown; error: unknown };

const CHAIN_METHODS = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit', 'single'];

// Mimics PostgREST's thenable builder: chained calls return the builder, awaiting it yields `result`.
function mockQuery(result: QueryResult) {
  const builder: Record<string, unknown> = {
    then: (
      onFulfilled: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  for (const method of CHAIN_METHODS) {
    builder[method] = jest.fn(() => builder);
  }
  mockedFrom.mockReturnValue(builder as never);
  return builder;
}

const cupStep: BreakdownStep = {
  id: 'step-1',
  title: 'Carry three cups to the sink',
  instruction: 'No washing yet.',
  estimatedMinutes: 2,
  difficulty: 'easy',
};

const row = {
  id: 'task-1',
  title: 'Clean the kitchen',
  empathy_bridge: 'Kitchens feel endless, I know.',
  first_step_hook: 'Stand up.',
  stopping_point: 'You can stop here.',
  // A legacy string step, a malformed entry and a structured step side by side.
  steps: [
    'Grab one cup',
    42,
    {
      id: 'step-2',
      title: 'Rinse it',
      instruction: 'Warm water, ten seconds.',
      estimated_minutes: 1,
      difficulty: 'easy',
    },
  ],
  completed_step_count: 1,
  completed_at: null,
  created_at: '2026-09-15T10:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('taskRepository.listRecent', () => {
  it('maps rows to domain objects, upgrading legacy steps and dropping malformed ones', async () => {
    mockQuery({ data: [row], error: null });

    await expect(taskRepository.listRecent(8)).resolves.toEqual([
      {
        id: 'task-1',
        title: 'Clean the kitchen',
        empathyBridge: 'Kitchens feel endless, I know.',
        firstStepHook: 'Stand up.',
        stoppingPoint: 'You can stop here.',
        steps: [
          {
            id: 'step-1',
            title: 'Grab one cup',
            instruction: '',
            estimatedMinutes: null,
            difficulty: null,
          },
          {
            id: 'step-2',
            title: 'Rinse it',
            instruction: 'Warm water, ten seconds.',
            estimatedMinutes: 1,
            difficulty: 'easy',
          },
        ],
        completedStepCount: 1,
        completedAt: null,
        createdAt: '2026-09-15T10:00:00Z',
      },
    ]);
  });

  it('reports a missing table as unavailable', async () => {
    mockQuery({ data: null, error: { code: 'PGRST205', message: 'relation not found' } });

    await expect(taskRepository.listRecent(8)).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('reports a missing backend configuration as unavailable', async () => {
    mockedGetSupabase.mockImplementationOnce(() => {
      throw new Error('Supabase is not configured');
    });

    await expect(taskRepository.listRecent(8)).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('reports other database errors as unknown', async () => {
    mockQuery({ data: null, error: { code: '42501', message: 'permission denied' } });

    await expect(taskRepository.listRecent(8)).rejects.toMatchObject({ code: 'unknown' });
  });
});

describe('taskRepository.breakDown', () => {
  it('returns flagged without touching the database', async () => {
    mockedBreakTask.mockResolvedValue({
      success: false,
      fallbackReason: FallbackReason.CONTENT_FLAGGED,
    });

    await expect(taskRepository.breakDown('something heavy')).resolves.toEqual({
      status: 'flagged',
    });
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('surfaces the fallback reason when the AI call fails', async () => {
    mockedBreakTask.mockResolvedValue({ success: false, fallbackReason: FallbackReason.RATE_DOWN });

    await expect(taskRepository.breakDown('Clean the kitchen')).resolves.toEqual({
      status: 'failed',
      reason: FallbackReason.RATE_DOWN,
    });
  });

  it('never saves generic offline fallback steps', async () => {
    mockedBreakTask.mockResolvedValue({ success: true, steps: [cupStep], source: 'offline' });

    const outcome = await taskRepository.breakDown('Clean the kitchen');

    expect(outcome).toMatchObject({ status: 'ready', saved: null, isOffline: true });
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it("never saves the server's deterministic fallback plan either", async () => {
    mockedBreakTask.mockResolvedValue({ success: true, steps: [cupStep], source: 'fallback' });

    const outcome = await taskRepository.breakDown('Clean the kitchen');

    expect(outcome).toMatchObject({ status: 'ready', saved: null, isOffline: false });
    expect(mockedFrom).not.toHaveBeenCalled();
  });

  it('saves structured breakdowns under the trimmed title', async () => {
    mockedBreakTask.mockResolvedValue({
      success: true,
      steps: [cupStep],
      empathyBridge: 'Kitchens feel endless, I know.',
      firstStepHook: 'Stand up.',
      stoppingPoint: 'You can stop here.',
      requestId: 'req-1',
      source: 'model',
    });
    const query = mockQuery({ data: row, error: null });

    const outcome = await taskRepository.breakDown('  Clean the kitchen  ');

    expect(outcome).toMatchObject({
      status: 'ready',
      isOffline: false,
      // Carried through so the finished session can be scored against this exact request.
      requestId: 'req-1',
      content: { title: 'Clean the kitchen', stoppingPoint: 'You can stop here.' },
      saved: { id: 'task-1' },
    });
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Clean the kitchen',
        stopping_point: 'You can stop here.',
        steps: [
          {
            id: 'step-1',
            title: 'Carry three cups to the sink',
            instruction: 'No washing yet.',
            estimated_minutes: 2,
            difficulty: 'easy',
          },
        ],
      })
    );
  });

  it('still returns the breakdown when saving fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockedBreakTask.mockResolvedValue({ success: true, steps: [cupStep], source: 'model' });
    mockQuery({ data: null, error: { code: '42501', message: 'permission denied' } });

    await expect(taskRepository.breakDown('Clean the kitchen')).resolves.toMatchObject({
      status: 'ready',
      saved: null,
    });
  });
});
