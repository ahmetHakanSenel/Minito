import { breakTask } from '../breakTask';
import { tracedAxios } from '../../requestTracing';
import { FallbackReason } from '../../../safety';

jest.mock('../../requestTracing', () => ({
  tracedAxios: { post: jest.fn() },
  newRequestId: jest.fn(() => 'req-test'),
}));
jest.mock('../../../data/supabase/client', () => {
  const client = {
    auth: { getSession: jest.fn(async () => ({ data: { session: { access_token: 'jwt' } } })) },
  };
  return { getSupabase: jest.fn(() => client) };
});
jest.mock('../../offlineFallback', () => ({
  getOfflineFallbackSteps: jest.fn(() => [
    {
      id: 'step-1',
      title: 'Take one small step',
      instruction: '',
      estimatedMinutes: null,
      difficulty: null,
    },
  ]),
}));

const mockedPost = jest.mocked(tracedAxios.post);

beforeAll(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('breakTask', () => {
  it('maps a task-breakdown-v1 response into structured steps', async () => {
    mockedPost.mockResolvedValue({
      data: {
        success: true,
        breakdown: {
          language: 'en',
          empathy_bridge: 'Kitchens feel endless, I know.',
          first_step_hook: 'Stand up.',
          steps: [
            {
              id: 'step-1',
              title: 'Carry three cups to the sink',
              instruction: 'No washing yet.',
              estimated_minutes: 2,
              difficulty: 'easy',
            },
          ],
          stopping_point: 'You can stop here.',
        },
        meta: { prompt_version: 'task-breakdown-v1', source: 'repaired' },
        token_usage: 420,
        latency_ms: 2300,
      },
    } as never);

    await expect(breakTask('Clean the kitchen')).resolves.toEqual({
      success: true,
      empathyBridge: 'Kitchens feel endless, I know.',
      firstStepHook: 'Stand up.',
      stoppingPoint: 'You can stop here.',
      steps: [
        {
          id: 'step-1',
          title: 'Carry three cups to the sink',
          instruction: 'No washing yet.',
          estimatedMinutes: 2,
          difficulty: 'easy',
        },
      ],
      requestId: 'req-test',
      source: 'repaired',
      promptVersion: 'task-breakdown-v1',
      tokenUsage: 420,
      latencyMs: 2300,
    });
    // The id travels in the body, not just the tracing header, so feedback can find this row.
    expect(mockedPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ request_id: 'req-test' }),
      expect.any(Object)
    );
  });

  it('refuses a success response whose steps are unusable', async () => {
    mockedPost.mockResolvedValue({
      data: { success: true, breakdown: { steps: [42, { title: '' }] } },
    } as never);

    // A malformed payload is a validation failure, not a plan with zero steps.
    await expect(breakTask('Clean the kitchen')).resolves.toMatchObject({
      success: false,
      fallbackReason: FallbackReason.VALIDATION,
    });
  });

  it('serves offline steps when the server fails', async () => {
    mockedPost.mockRejectedValue({ response: { status: 503 }, message: 'Service unavailable' });

    await expect(breakTask('Clean the kitchen')).resolves.toMatchObject({
      success: true,
      source: 'offline',
      steps: [{ title: 'Take one small step' }],
    });
  });

  it('surfaces rate limiting instead of hiding it behind offline steps', async () => {
    mockedPost.mockRejectedValue({ response: { status: 429 }, message: 'Too many requests' });

    await expect(breakTask('Clean the kitchen')).resolves.toMatchObject({
      success: false,
      fallbackReason: FallbackReason.RATE_DOWN,
    });
  });
});
