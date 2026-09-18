import { AxiosError, AxiosHeaders } from 'axios';
import { breakTask } from '../breakTask';
import { tracedAxios } from '../../requestTracing';
import { getSupabase } from '../../../data/supabase/client';
import { FallbackReason } from '../../../safety';

jest.mock('../../requestTracing', () => ({
  tracedAxios: { post: jest.fn() },
  newRequestId: jest.fn(() => 'client-trace-id'),
}));
jest.mock('../../../data/supabase/client', () => {
  const client = {
    auth: { getSession: jest.fn() },
  };
  return { getSupabase: jest.fn(() => client) };
});
jest.mock('../../i18n/config', () => ({
  __esModule: true,
  default: { language: 'tr-TR' },
}));
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
const mockedGetSession = jest.mocked(getSupabase().auth.getSession);

function httpError(status: number): AxiosError {
  const headers = new AxiosHeaders();
  return new AxiosError(`HTTP ${status}`, 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: '',
    headers,
    config: { headers },
    data: {},
  });
}

beforeAll(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockedGetSession.mockResolvedValue({
    data: { session: { access_token: 'jwt' } },
    error: null,
  } as never);
});

describe('breakTask', () => {
  // The server can only guess the language of a short task, and used to guess English. The app
  // has never had to guess: this is the language its own interface is in.
  it('tells the server what language the app is running in', async () => {
    mockedPost.mockResolvedValue({ data: { success: true, breakdown: undefined } });

    await breakTask('kargo');

    expect(mockedPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ input: 'kargo', language: 'tr' }),
      expect.anything()
    );
  });

  it('maps a structured response and keeps the server-issued request id for feedback', async () => {
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
        meta: {
          prompt_version: 'task-breakdown-v2',
          source: 'repaired',
          request_id: 'server-row-id',
        },
        token_usage: 420,
        latency_ms: 2300,
      },
    } as never);

    await expect(breakTask('  Clean the kitchen  ')).resolves.toEqual({
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
      requestId: 'server-row-id',
      source: 'repaired',
      promptVersion: 'task-breakdown-v2',
      tokenUsage: 420,
      latencyMs: 2300,
    });

    // One tracing id, in the body and the header alike, so client and server logs line up.
    expect(mockedPost).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/break-task',
      { input: 'Clean the kitchen', request_id: 'client-trace-id', language: 'tr' },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt',
          'x-request-id': 'client-trace-id',
        }),
      })
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

  it('passes flagged content through as its own reason', async () => {
    mockedPost.mockResolvedValue({
      data: { success: false, fallback_reason: 'CONTENT_FLAGGED' },
    } as never);

    await expect(breakTask('something heavy')).resolves.toMatchObject({
      success: false,
      fallbackReason: FallbackReason.CONTENT_FLAGGED,
    });
  });

  it('does not trust an unknown reason code from the network', async () => {
    mockedPost.mockResolvedValue({
      data: { success: false, fallback_reason: 'SOMETHING_NEW' },
    } as never);

    await expect(breakTask('Clean the kitchen')).resolves.toMatchObject({
      fallbackReason: FallbackReason.VALIDATION,
    });
  });

  it.each([500, 503])('serves offline steps when the server answers %i', async (status) => {
    mockedPost.mockRejectedValue(httpError(status));

    await expect(breakTask('Clean the kitchen')).resolves.toMatchObject({
      success: true,
      source: 'offline',
      steps: [{ title: 'Take one small step' }],
    });
  });

  it('serves offline steps when the request never gets an answer', async () => {
    mockedPost.mockRejectedValue(new AxiosError('timeout of 20000ms exceeded', 'ECONNABORTED'));

    await expect(breakTask('Clean the kitchen')).resolves.toMatchObject({ source: 'offline' });
  });

  it('serves offline steps when no backend is configured', async () => {
    jest.mocked(getSupabase).mockImplementationOnce(() => {
      throw new Error('Supabase is not configured');
    });

    await expect(breakTask('Clean the kitchen')).resolves.toMatchObject({ source: 'offline' });
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('surfaces rate limiting instead of hiding it behind offline steps', async () => {
    mockedPost.mockRejectedValue(httpError(429));

    await expect(breakTask('Clean the kitchen')).resolves.toMatchObject({
      success: false,
      fallbackReason: FallbackReason.RATE_DOWN,
    });
  });

  it('reports a rejected session so the user can sign in again', async () => {
    mockedPost.mockRejectedValue(httpError(401));

    await expect(breakTask('Clean the kitchen')).resolves.toMatchObject({
      success: false,
      fallbackReason: FallbackReason.AUTH_EXPIRED,
    });
  });

  it('does not call the server without a session', async () => {
    mockedGetSession.mockResolvedValueOnce({ data: { session: null }, error: null } as never);

    await expect(breakTask('Clean the kitchen')).resolves.toMatchObject({
      success: false,
      fallbackReason: FallbackReason.AUTH_EXPIRED,
    });
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it('treats other client errors as a rejected request', async () => {
    mockedPost.mockRejectedValue(httpError(400));

    await expect(breakTask('Clean the kitchen')).resolves.toMatchObject({
      fallbackReason: FallbackReason.VALIDATION,
    });
  });
});
