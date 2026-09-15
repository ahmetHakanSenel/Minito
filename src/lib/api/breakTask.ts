import { tracedAxios } from '../requestTracing';
import { getSupabase } from '../../data/supabase/client';
import { FallbackReason } from '../../safety';
import { getOfflineFallbackSteps } from '../offlineFallback';

/**
 * Response from break-task edge function
 * Updated for Neuro-Cognitive Companion persona
 */
export interface BreakTaskResponse {
  success: boolean;
  empathy_bridge?: string; // Acknowledgement of how hard the task feels
  first_step_hook?: string; // Stupidly easy action to break paralysis
  steps?: string[];
  fallback_reason?: FallbackReason;
  panic_kit?: {
    headline: string;
    steps: Array<{ id: string; title: string; body: string }>;
  };
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
 * Updated for Neuro-Cognitive Companion persona
 */
export type BreakTaskResult =
  | {
      success: true;
      empathyBridge?: string; // Acknowledgement of how hard the task feels
      firstStepHook?: string; // Stupidly easy action to break paralysis
      steps: string[];
      tokenUsage?: number;
      latencyMs?: number;
      isOfflineFallback?: boolean;
    }
  | {
      success: false;
      fallbackReason: FallbackReason;
      error?: string;
    };

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
    try {
      const offlineSteps = getOfflineFallbackSteps(input.trim());
      return {
        success: true,
        steps: offlineSteps,
        isOfflineFallback: true,
      };
    } catch (fallbackError) {
      return {
        success: false,
        fallbackReason: FallbackReason.DB_DOWN,
        error: 'Edge function URL not configured',
      };
    }
  }

  try {
    const requestPayload: BreakTaskRequest = {
      input: input.trim(),
      guest_id: guestId,
      // request_id is automatically added by tracedAxios interceptor
    };

    // The edge function only serves signed-in users; the JWT identifies them for rate limiting.
    const {
      data: { session },
    } = await getSupabase().auth.getSession();
    if (!session) {
      return { success: false, fallbackReason: FallbackReason.VALIDATION, error: 'Not signed in' };
    }

    const response = await tracedAxios.post<BreakTaskResponse>(edgeFunctionUrl, requestPayload, {
      // Hard ceiling on perceived latency: past this point the offline
      // fallback is a better experience than continuing to wait. The
      // server's own retry cascade can otherwise stretch to 30s+.
      timeout: 8000,
      headers: {
        'Content-Type': 'application/json',
        ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {}),
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = response.data;

    if (data.success && data.steps) {
      return {
        success: true,
        empathyBridge: data.empathy_bridge,
        firstStepHook: data.first_step_hook,
        steps: data.steps,
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
      try {
        const offlineSteps = getOfflineFallbackSteps(input.trim());
        return {
          success: true,
          steps: offlineSteps,
          isOfflineFallback: true,
        };
      } catch (fallbackError) {
        // If offline fallback also fails, return error
        console.warn('Offline fallback failed:', fallbackError);
      }
    }

    return {
      success: false,
      fallbackReason,
      error: error.message || 'Network error occurred',
    };
  }
}
