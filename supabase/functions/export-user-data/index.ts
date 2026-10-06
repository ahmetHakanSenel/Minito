import { corsHeaders, describeError, guardMethod, jsonResponse } from '../_shared/http.ts';
import {
  AuthUnavailableError,
  authenticateRequest,
  createAdminClient,
} from '../_shared/supabase.ts';

/**
 * Edge Function: export-user-data (right of access and portability)
 *
 * Returns everything stored about the caller: the account, the saved breakdown history, the
 * planner, and the AI request log. The history and the planner hold the person's own text. The
 * request log holds the generated plans and an HMAC of each task rather than its text; the HMAC
 * is left out, as it means nothing without the server's secret.
 */

const METHODS = ['GET'];
const CORS = corsHeaders(METHODS);

const BREAKDOWN_COLUMNS =
  'title, empathy_bridge, first_step_hook, stopping_point, steps, completed_step_count, completed_at, created_at';

const PROJECT_COLUMNS = 'id, title, color, due_date, deleted_at, created_at, updated_at';

const PLANNER_TASK_COLUMNS =
  'id, project_id, title, is_completed, position, deleted_at, created_at, updated_at';

const REQUEST_LOG_COLUMNS =
  'request_id, created_at, prompt_version, ai_model, breakdown_source, fallback_reason, steps, feedback_score, feedback_at';

Deno.serve(async (req) => {
  const rejected = guardMethod(req, METHODS, CORS);
  if (rejected) return rejected;

  try {
    const admin = createAdminClient();
    const user = await authenticateRequest(req, admin);
    if (!user) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401, CORS);
    }

    // The service role bypasses RLS, so both queries scope themselves to the verified user.
    const [breakdowns, requests, projects, plannerTasks] = await Promise.all([
      admin
        .from('task_breakdowns')
        .select(BREAKDOWN_COLUMNS)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      admin
        .from('tasks')
        .select(REQUEST_LOG_COLUMNS)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      admin.from('planner_projects').select(PROJECT_COLUMNS).eq('user_id', user.id),
      admin.from('planner_tasks').select(PLANNER_TASK_COLUMNS).eq('user_id', user.id),
    ]);

    const failure = breakdowns.error ?? requests.error ?? projects.error ?? plannerTasks.error;
    if (failure) {
      console.error(
        JSON.stringify({ level: 'error', event: 'export_user_data.failed', error: failure.message })
      );
      return jsonResponse({ success: false, error: 'Failed to export user data' }, 500, CORS);
    }

    const exportData = {
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      },
      task_breakdowns: breakdowns.data ?? [],
      ai_requests: requests.data ?? [],
      // Deleted items are kept briefly as tombstones so other devices learn about the deletion.
      planner: { projects: projects.data ?? [], tasks: plannerTasks.data ?? [] },
      metadata: {
        export_date: new Date().toISOString(),
        note: 'Includes your saved breakdowns, your planner and the log of your AI requests. Your tasks appear in full in the breakdowns and the planner; the request log keeps only a keyed hash of each one.',
      },
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="minito-export-${Date.now()}.json"`,
        // Personal data: never let an intermediary cache it.
        'Cache-Control': 'no-store',
      },
    });
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
        event: 'export_user_data.unhandled_error',
        error: describeError(error),
      })
    );
    return jsonResponse({ success: false, error: 'Internal server error' }, 500, CORS);
  }
});
