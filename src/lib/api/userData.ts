import { isAxiosError } from 'axios';
import { tracedAxios } from '../requestTracing';
import { getSupabase } from '../../data/supabase/client';

/** The shape `export-user-data` returns. */
export type UserDataExport = {
  user: { id: string; email?: string; created_at: string; last_sign_in_at?: string };
  task_breakdowns: Record<string, unknown>[];
  ai_requests: Record<string, unknown>[];
  planner: { projects: Record<string, unknown>[]; tasks: Record<string, unknown>[] };
  metadata: { export_date: string; note: string };
};

function functionUrl(name: string): string | undefined {
  const breakTaskUrl = process.env.EXPO_PUBLIC_SUPABASE_EDGE_FUNCTION_URL;
  if (breakTaskUrl) return breakTaskUrl.replace(/\/break-task\/?$/, `/${name}`);
  return process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$|$/, `/functions/v1/${name}`);
}

async function authorizedRequest(name: string): Promise<{ url: string; token: string }> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) {
    throw new Error('No active session. Please sign in first.');
  }
  const url = functionUrl(name);
  if (!url) {
    throw new Error('Edge function URL not configured');
  }
  return { url, token: session.access_token };
}

// The server's own message is safe to show; it never carries internals.
function toUserFacingError(error: unknown, fallbackMessage: string): Error {
  if (isAxiosError<{ error?: string }>(error) && error.response) {
    return new Error(error.response.data?.error || fallbackMessage);
  }
  return error instanceof Error ? error : new Error(fallbackMessage);
}

/** Deletes the account and, through cascading deletes, everything it owns (right to erasure). */
export async function deleteUserAccount(): Promise<void> {
  const { url, token } = await authorizedRequest('delete-user');
  try {
    await tracedAxios.delete(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (error) {
    throw toUserFacingError(error, 'Failed to delete user account');
  }
}

/** Everything stored about the signed-in user (right of access and portability). */
export async function exportUserData(): Promise<UserDataExport> {
  const { url, token } = await authorizedRequest('export-user-data');
  try {
    const response = await tracedAxios.get<UserDataExport>(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    throw toUserFacingError(error, 'Failed to export user data');
  }
}
