import { getSupabase } from '../../data/supabase/client';
import { feedbackRepository } from '../feedbackRepository';

jest.mock('../../data/supabase/client', () => {
  const client = { rpc: jest.fn() };
  return { getSupabase: jest.fn(() => client) };
});

const mockedRpc = jest.mocked(getSupabase().rpc);
const mockedGetSupabase = jest.mocked(getSupabase);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('feedbackRepository.submit', () => {
  it('scores the request through the locked-down function', async () => {
    mockedRpc.mockResolvedValue({ data: true, error: null } as never);

    await expect(feedbackRepository.submit('req-1', 'too_large')).resolves.toBe(true);
    expect(mockedRpc).toHaveBeenCalledWith('submit_breakdown_feedback', {
      p_request_id: 'req-1',
      p_score: 'too_large',
    });
  });

  it('reports false when no row of the caller matches the request', async () => {
    mockedRpc.mockResolvedValue({ data: false, error: null } as never);

    await expect(feedbackRepository.submit('req-unknown', 'helpful')).resolves.toBe(false);
  });

  it('reports a missing function as unavailable', async () => {
    mockedRpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'function not found' },
    } as never);

    await expect(feedbackRepository.submit('req-1', 'helpful')).rejects.toMatchObject({
      code: 'unavailable',
    });
  });

  it('reports a missing backend configuration as unavailable', async () => {
    mockedGetSupabase.mockImplementationOnce(() => {
      throw new Error('Supabase is not configured');
    });

    await expect(feedbackRepository.submit('req-1', 'helpful')).rejects.toMatchObject({
      code: 'unavailable',
    });
  });

  it('reports other database errors as unknown', async () => {
    mockedRpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    } as never);

    await expect(feedbackRepository.submit('req-1', 'helpful')).rejects.toMatchObject({
      code: 'unknown',
    });
  });
});
