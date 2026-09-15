import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { requestGoogleIdToken } from '../../data/auth/googleAuth';
import { supabase } from '../../data/supabase/client';
import { authRepository } from '../authRepository';

jest.mock('../../data/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signInWithIdToken: jest.fn(),
      signOut: jest.fn(),
      updateUser: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));
jest.mock('../../data/auth/googleAuth', () => ({
  isGoogleSignInAvailable: jest.fn(),
  requestGoogleIdToken: jest.fn(),
}));
jest.mock('../../data/auth/appleAuth', () => ({
  isAppleSignInAvailable: jest.fn(),
  requestAppleIdToken: jest.fn(),
}));

const auth = jest.mocked(supabase.auth);
const mockedRequestGoogleIdToken = jest.mocked(requestGoogleIdToken);

// Supabase response types are wide; these tests only exercise the fields the repository reads.
function respond(value: unknown) {
  return value as never;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authRepository email flows', () => {
  it('maps rejected credentials to a typed error code', async () => {
    auth.signInWithPassword.mockResolvedValue(
      respond({
        data: {},
        error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
      })
    );

    await expect(authRepository.signInWithEmail('a@b.co', 'secret1')).rejects.toMatchObject({
      name: 'AuthRepositoryError',
      code: 'invalid_credentials',
    });
  });

  it('treats retryable fetch failures as network errors', async () => {
    auth.signInWithPassword.mockResolvedValue(
      respond({ data: {}, error: new AuthRetryableFetchError('Failed to fetch', 0) })
    );

    await expect(authRepository.signInWithEmail('a@b.co', 'secret1')).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('maps an already registered email to user_already_exists', async () => {
    auth.signUp.mockResolvedValue(
      respond({ data: {}, error: new AuthApiError('User already registered', 422, 'email_exists') })
    );

    await expect(authRepository.signUpWithEmail('a@b.co', 'secret1', 'Hako')).rejects.toMatchObject(
      { code: 'user_already_exists' }
    );
  });

  it('stores the display name and reports pending email confirmation', async () => {
    auth.signUp.mockResolvedValue(
      respond({ data: { user: { id: 'user-1' }, session: null }, error: null })
    );

    await expect(authRepository.signUpWithEmail('a@b.co', 'secret1', 'Hako')).resolves.toEqual({
      needsEmailConfirmation: true,
    });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'secret1',
      options: { data: { display_name: 'Hako' } },
    });
  });
});

describe('authRepository provider flows', () => {
  it('reports a cancelled provider sheet without calling Supabase', async () => {
    mockedRequestGoogleIdToken.mockResolvedValue(null);

    await expect(authRepository.signInWithGoogle()).rejects.toMatchObject({ code: 'cancelled' });
    expect(auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('wraps native provider failures as provider_unavailable', async () => {
    mockedRequestGoogleIdToken.mockRejectedValue(new Error('DEVELOPER_ERROR'));

    await expect(authRepository.signInWithGoogle()).rejects.toMatchObject({
      code: 'provider_unavailable',
    });
  });

  it('exchanges the provider ID token for a Supabase session', async () => {
    mockedRequestGoogleIdToken.mockResolvedValue('google-id-token');
    auth.signInWithIdToken.mockResolvedValue(respond({ data: {}, error: null }));

    await expect(authRepository.signInWithGoogle()).resolves.toBeUndefined();
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'google-id-token',
    });
  });
});
