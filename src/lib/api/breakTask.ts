import { newRequestId, tracedAxios } from '../requestTracing';
import { getSupabase } from '../../data/supabase/client';
import { FallbackReason } from '../../safety';
import { getOfflineFallbackSteps } from '../offlineFallback';
import { normalizeSteps, type BreakdownStep, type StepDifficulty } from '../breakdownSteps';

/** Where a successful breakdown came from; `offline` never reached the server. */
export type BreakdownSource = 'model' | 'repaired' | 'fallback' | 'offline';

/**
 * Response from the break-task edge function (output contract `task-breakdown-v1`).
 */
export interface BreakTaskResponse {
  success: boolean;
  breakdown?: {
    language: 'tr' | 'en';
    empathy_bridge: string; // Acknowledgement of how hard the task feels
    first_step_hook: string; // Stupidly easy action to break paralysis
    steps: {
      id: string;
      title: string;
      instruction: string;
      estimated_minutes: number;
      difficulty: StepDifficulty;
    }[];
    stopping_point: string; // Explicit permission to stop after the last step
  };
  meta?: { prompt_version: string; source: Exclude<BreakdownSource, 'offline'> };
  // A function deployed before task-breakdown-v1 answers with flat string steps; still readable.
  empathy_bridge?: string;
  first_step_hook?: string;
  steps?: unknown[];
  fallback_reason?: FallbackReason;
  error?: string;
  token_usage?: number;
  latency_ms?: number;
}

/**
 * Request payload for break-task edge function
 */
export interface BreakTaskRequest {
  input: string;
  guest_id?: string;
  request_id?: string;
}

/**
 * Result type for breakTask function
 */
export type BreakTaskResult =
  | {
      success: true;
      empathyBridge?: string;
      firstStepHook?: string;
      stoppingPoint?: string;
      steps: BreakdownStep[];
      /** Tracing id of the analytics row this breakdown was logged under, for later feedback. */
      requestId?: string;
      source: BreakdownSource;
      promptVersion?: string;
      tokenUsage?: number;
      latencyMs?: number;
    }
  | {
      success: false;
      fallbackReason: FallbackReason;
      error?: string;
    };

// Hard ceiling on perceived latency. It covers generation plus one repair round-trip, and the
// server budgets itself to answer inside it; past this point offline steps beat waiting.
const REQUEST_TIMEOUT_MS = 20_000;

function offlineResult(input: string): BreakTaskResult {
  return { success: true, steps: getOfflineFallbackSteps(input), source: 'offline' };
}

// Generated here rather than by the tracing interceptor, because feedback needs this exact id
// later. Without one the breakdown still works; only the feedback link is lost.
function safeRequestId(): string | undefined {
  try {
    return newRequestId();
  } catch (error) {
    console.warn('Failed to generate a request id:', error);
    return undefined;
  }
}

/**
 * Calls the break-task edge function to break down a user task into steps.
 *
 * @param input - The user's task input
 * @param guestId - Optional guest ID for tracking
 * @returns Promise<BreakTaskResult>
 *
 * @example
 * ```ts
 * const result = await breakTask("Learn React Native", guestId);
 * if (result.success) {
 *   console.log(result.steps);
 * } else {
 *   console.log(result.fallbackReason);
 * }
 * ```
 */
export async function breakTask(input: string, guestId?: string): Promise<BreakTaskResult> {
  // The Supabase gateway still expects the anon key as `apikey`; identity comes from the JWT.
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const edgeFunctionUrl =
    process.env.EXPO_PUBLIC_SUPABASE_EDGE_FUNCTION_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$|$/, '/functions/v1/break-task');

  if (!edgeFunctionUrl) {
    // No edge function URL configured - use offline fallback
    return offlineResult(input.trim());
  }

  const requestId = safeRequestId();

  try {
    const requestPayload: BreakTaskRequest = {
      input: input.trim(),
      guest_id: guestId,
      request_id: requestId,
    };

    // The edge function only serves signed-in users; the JWT identifies them for rate limiting.
    const {
      data: { session },
    } = await getSupabase().auth.getSession();
    if (!session) {
      return { success: false, fallbackReason: FallbackReason.VALIDATION, error: 'Not signed in' };
    }

    const response = await tracedAxios.post<BreakTaskResponse>(edgeFunctionUrl, requestPayload, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {}),
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = response.data;
    const breakdown = data.breakdown;
    // The response is still untrusted input: only well-formed steps make it into the app.
    const steps = normalizeSteps(breakdown?.steps ?? data.steps);

    if (data.success && steps.length > 0) {
      return {
        success: true,
        empathyBridge: breakdown?.empathy_bridge ?? data.empathy_bridge,
        firstStepHook: breakdown?.first_step_hook ?? data.first_step_hook,
        stoppingPoint: breakdown?.stopping_point,
        steps,
        requestId,
        source: data.meta?.source ?? 'model',
        promptVersion: data.meta?.prompt_version,
        tokenUsage: data.token_usage,
        latencyMs: data.latency_ms,
      };
    }

    // Handle fallback cases. CONTENT_FLAGGED needs no payload — the panic
    // screen renders its own localized content from the reason code alone.
    const fallbackReason = (data.fallback_reason as FallbackReason) || FallbackReason.VALIDATION;

    return {
      success: false,
      fallbackReason,
      error: data.error || 'Unknown error occurred',
    };
  } catch (error: any) {
    // Fail-soft: handle network errors gracefully
    console.warn('breakTask API call failed:', error);

    // Determine fallback reason from error
    let fallbackReason: FallbackReason = FallbackReason.AI_DOWN;
    let isNetworkError = false;

    if (error.response) {
      // HTTP error response
      const status = error.response.status;
      if (status >= 500) {
        // Server errors - use offline fallback
        fallbackReason = FallbackReason.DB_DOWN;
        isNetworkError = true;
      } else if (status === 429) {
        fallbackReason = FallbackReason.RATE_DOWN;
      } else if (status === 400 || status === 401) {
        fallbackReason = FallbackReason.VALIDATION;
      }
    } else if (error.request) {
      // Network error (no response) - use offline fallback
      fallbackReason = FallbackReason.AI_DOWN;
      isNetworkError = true;
    } else {
      // Other errors (e.g., URL parsing) - use offline fallback
      isNetworkError = true;
    }

    // If it's a network/server error, provide offline fallback steps
    if (isNetworkError) {
      return offlineResult(input.trim());
    }

    return {
      success: false,
      fallbackReason,
      error: error.message || 'Network error occurred',
    };
  }
}
