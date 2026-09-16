import { assertEquals, assertRejects } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';
import { AuthUnavailableError, resolveUser } from './supabase.ts';

function adminAnswering(result: { data: unknown; error: unknown }): SupabaseClient {
  return { auth: { getUser: () => Promise.resolve(result) } } as unknown as SupabaseClient;
}

const authError = (status: number | undefined) =>
  Object.assign(new Error('auth said no'), { name: 'AuthApiError', status });

Deno.test('a token Auth rejects resolves to no user', async () => {
  for (const status of [400, 401, 403, 404]) {
    const admin = adminAnswering({ data: { user: null }, error: authError(status) });
    assertEquals(await resolveUser(admin, 'token'), null, String(status));
  }
});

Deno.test('an Auth failure is not mistaken for a rejected token', async () => {
  for (const status of [undefined, 0, 429, 500, 502, 503]) {
    const admin = adminAnswering({ data: { user: null }, error: authError(status) });
    await assertRejects(() => resolveUser(admin, 'token'), AuthUnavailableError);
  }
});

Deno.test('a verified token resolves to its user', async () => {
  const user = { id: 'u1', user_metadata: {} };
  assertEquals(await resolveUser(adminAnswering({ data: { user }, error: null }), 't'), user);
});
