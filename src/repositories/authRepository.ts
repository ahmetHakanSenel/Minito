import { isAuthError, isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { supabase } from '../data/supabase/client';
import { isAppleSignInAvailable, requestAppleIdToken } from '../data/auth/appleAuth';
import { isGoogleSignInAvailable, requestGoogleIdToken } from '../data/auth/googleAuth';

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_already_exists'
  | 'weak_password'
  | 'invalid_email'
  | 'rate_limited'
  | 'network'
  | 'provider_unavailable'
  | 'cancelled'
  | 'unknown';

export class AuthRepositoryError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    readonly original?: unknown
  ) {
    super(`Authentication failed: ${code}`);
    this.name = 'AuthRepositoryError';
  }
}

export type SignUpResult = {
  needsEmailConfirmation: boolean;
};

function mapSupabaseCode(code: string | undefined): AuthErrorCode {
  switch (code) {
    case 'invalid_credentials':
      return 'invalid_credentials';
    case 'email_not_confirmed':
      return 'email_not_confirmed';
    case 'user_already_exists':
    case 'email_exists':
      return 'user_already_exists';
    case 'weak_password':
      return 'weak_password';
    case 'email_address_invalid':
      return 'invalid_email';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rate_limited';
    default:
      return 'unknown';
  }
}

function toRepositoryError(error: unknown): AuthRepositoryError {
  if (error instanceof AuthRepositoryError) {
    return error;
  }
  if (isAuthRetryableFetchError(error)) {
    return new AuthRepositoryError('network', error);
  }
  if (isAuthError(error)) {
    return new AuthRepositoryError(mapSupabaseCode(error.code), error);
  }
  return new AuthRepositoryError('unknown', error);
}

function onSessionChange(listener: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(session));
  return () => data.subscription.unsubscribe();
}

async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw toRepositoryError(error);
  }
}

async function signUpWithEmail(email: string, password: string): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    throw toRepositoryError(error);
  }
  // With email confirmation enabled, Supabase creates the user but withholds the session.
  return { needsEmailConfirmation: data.session === null };
}

async function signInWithProvider(
  provider: 'google' | 'apple',
  requestIdToken: () => Promise<string | null>
): Promise<void> {
  let token: string | null;
  try {
    token = await requestIdToken();
  } catch (error) {
    throw new AuthRepositoryError('provider_unavailable', error);
  }
  if (token === null) {
    throw new AuthRepositoryError('cancelled');
  }
  const { error } = await supabase.auth.signInWithIdToken({ provider, token });
  if (error) {
    throw toRepositoryError(error);
  }
}

async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw toRepositoryError(error);
  }
}

export const authRepository = {
  onSessionChange,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle: (): Promise<void> => signInWithProvider('google', requestGoogleIdToken),
  signInWithApple: (): Promise<void> => signInWithProvider('apple', requestAppleIdToken),
  signOut,
  isGoogleSignInAvailable: (): Promise<boolean> => isGoogleSignInAvailable().catch(() => false),
  isAppleSignInAvailable: (): Promise<boolean> => isAppleSignInAvailable().catch(() => false),
};
