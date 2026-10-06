import { isAuthError, isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { BackendUnavailableError, getSupabase, isBackendConfigured } from '../data/supabase/client';
import { isAppleSignInAvailable, requestAppleCredential } from '../data/auth/appleAuth';
import { isGoogleSignInAvailable, requestGoogleCredential } from '../data/auth/googleAuth';
import type { IdTokenCredential } from '../data/auth/idTokenCredential';

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_already_exists'
  | 'weak_password'
  | 'invalid_email'
  | 'rate_limited'
  | 'network'
  | 'backend_unavailable'
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

export const DISPLAY_NAME_MAX_LENGTH = 30;

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
  if (error instanceof BackendUnavailableError) {
    return new AuthRepositoryError('backend_unavailable', error);
  }
  if (isAuthRetryableFetchError(error)) {
    return new AuthRepositoryError('network', error);
  }
  if (isAuthError(error)) {
    return new AuthRepositoryError(mapSupabaseCode(error.code), error);
  }
  return new AuthRepositoryError('unknown', error);
}

// Resolving the client per call turns a missing backend into a typed, recoverable error.
function auth() {
  try {
    return getSupabase().auth;
  } catch (error) {
    throw toRepositoryError(error);
  }
}

function onSessionChange(listener: (session: Session | null) => void): () => void {
  if (!isBackendConfigured) {
    // Nothing to restore without a backend; report "signed out" so the app can finish booting.
    listener(null);
    return () => {};
  }
  const { data } = auth().onAuthStateChange((_event, session) => listener(session));
  return () => data.subscription.unsubscribe();
}

async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await auth().signInWithPassword({ email, password });
  if (error) {
    throw toRepositoryError(error);
  }
}

async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<SignUpResult> {
  const { data, error } = await auth().signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) {
    throw toRepositoryError(error);
  }
  // With email confirmation enabled, Supabase creates the user but withholds the session.
  return { needsEmailConfirmation: data.session === null };
}

async function signInWithProvider(
  provider: 'google' | 'apple',
  requestCredential: () => Promise<IdTokenCredential | null>
): Promise<void> {
  const supabaseAuth = auth();
  let credential: IdTokenCredential | null;
  try {
    credential = await requestCredential();
  } catch (error) {
    throw new AuthRepositoryError('provider_unavailable', error);
  }
  if (credential === null) {
    throw new AuthRepositoryError('cancelled');
  }
  // With a nonce, Supabase checks that the token was issued for this very sign-in attempt.
  const { error } = await supabaseAuth.signInWithIdToken({
    provider,
    token: credential.token,
    ...(credential.nonce ? { nonce: credential.nonce } : {}),
  });
  if (error) {
    throw toRepositoryError(error);
  }
}

async function signOut(): Promise<void> {
  const { error } = await auth().signOut();
  if (error) {
    throw toRepositoryError(error);
  }
}

// Supabase emits USER_UPDATED afterwards, so session listeners pick up the new name.
async function updateDisplayName(displayName: string): Promise<void> {
  const { error } = await auth().updateUser({ data: { display_name: displayName } });
  if (error) {
    throw toRepositoryError(error);
  }
}

export const authRepository = {
  isBackendAvailable: isBackendConfigured,
  onSessionChange,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle: (): Promise<void> => signInWithProvider('google', requestGoogleCredential),
  signInWithApple: (): Promise<void> => signInWithProvider('apple', requestAppleCredential),
  signOut,
  updateDisplayName,
  isGoogleSignInAvailable: (): Promise<boolean> => isGoogleSignInAvailable().catch(() => false),
  isAppleSignInAvailable: (): Promise<boolean> => isAppleSignInAvailable().catch(() => false),
};
