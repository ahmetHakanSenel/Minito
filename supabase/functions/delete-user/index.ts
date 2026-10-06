import { corsHeaders, describeError, guardMethod, jsonResponse } from '../_shared/http.ts';
import {
  AuthUnavailableError,
  authenticateRequest,
  createAdminClient,
} from '../_shared/supabase.ts';

/**
 * Edge Function: delete-user (right to erasure)
 *
 * Deletes the caller's auth account. Every user-owned row (`task_breakdowns`, `tasks`, `planner_*`) references
 * `auth.users` with ON DELETE CASCADE, so the database removes them in the same transaction.
 * Rate-limit counters are deliberately not user-owned: deleting an account must not reset them.
 */

const METHODS = ['DELETE', 'POST'];
const CORS = corsHeaders(METHODS);

Deno.serve(async (req) => {
  const rejected = guardMethod(req, METHODS, CORS);
  if (rejected) return rejected;

  try {
    const admin = createAdminClient();
    const user = await authenticateRequest(req, admin);
    if (!user) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401, CORS);
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(
        JSON.stringify({ level: 'error', event: 'delete_user.failed', error: error.message })
      );
      return jsonResponse({ success: false, error: 'Failed to delete user account' }, 500, CORS);
    }

    console.log(JSON.stringify({ level: 'info', event: 'delete_user.completed' }));
    return jsonResponse({ success: true }, 200, CORS);
  } catch (error) {
    if (error instanceof AuthUnavailableError) {
      return jsonResponse(
        { success: false, error: 'Authentication is temporarily unavailable' },
        503,
        CORS
      );
    }
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'delete_user.unhandled_error',
        error: describeError(error),
      })
    );
    return jsonResponse({ success: false, error: 'Internal server error' }, 500, CORS);
  }
});
