import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.89.0';
import { bearerToken, requireEnv } from './http.ts';

/**
 * A service-role client. It bypasses RLS, so it only ever runs server-side, and every query made
 * with it must scope itself to the verified user.
 */
export function createAdminClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Auth could not give an answer, which is different from answering "not signed in". */
export class AuthUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthUnavailableError';
  }
}

/**
 * The signed-in user behind a token, or null when Auth rejects the token (anon, expired,
 * malformed). Anything else throws AuthUnavailableError: answering 401 during an Auth outage
 * would tell every client its session is gone, and they would all sign out at once.
 */
export async function resolveUser(admin: SupabaseClient, token: string): Promise<User | null> {
  const { data, error } = await admin.auth.getUser(token);
  if (!error) return data.user ?? null;
  if (
    error.status !== undefined &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 429
  ) {
    return null;
  }
  throw new AuthUnavailableError(
    `${error.name} (${error.status ?? 'no status'}): ${error.message}`
  );
}

/** resolveUser for a request's bearer token; a request without one is simply not signed in. */
export function authenticateRequest(req: Request, admin: SupabaseClient): Promise<User | null> {
  const token = bearerToken(req);
  return token ? resolveUser(admin, token) : Promise.resolve(null);
}
