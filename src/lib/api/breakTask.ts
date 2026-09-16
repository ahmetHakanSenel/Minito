import { isAxiosError } from 'axios';
import { newRequestId, tracedAxios } from '../requestTracing';
import { getSupabase } from '../../data/supabase/client';
import { FallbackReason } from '../../safety';
import { getOfflineFallbackSteps } from '../offlineFallback';
import { normalizeSteps, type BreakdownStep, type StepDifficulty } from '../breakdownSteps';

/** Where a successful breakdown came from; `offline` never reached the server. */
export type BreakdownSource = 'model' | 'repaired' | 'fallback' | 'offline';

/**
 * Response from the break-task edge function. The breakdown follows the server's versioned
 * output contract; `meta.prompt_version` says which one.
 */
export interface BreakTaskResponse {
  success: boolean;
  breakdown?: {
    language: 'tr' | 'en';
    empathy_bridge: string; // Acknowledgement of how hard the task feels
    first_step_hook: string; // Laughably easy action that breaks the paralysis
    steps: {
      id: string;
      title: string;
      instruction: string;
      estimated_minutes: number;
      difficulty: StepDifficulty;
    }[];
    stopping_point: string; // Explicit permission to stop after the last step
  };
  meta?: {
    prompt_version: string;
    source: Exclude<BreakdownSource, 'offline'>;
    /** The id the server stored this request's telemetry under. Feedback must use this one. */
    request_id?: string;
  };
  fallback_reason?: string;
  error?: string;
  token_usage?: number;
  latency_ms?: number;
}

export interface BreakTaskRequest {
  input: string;
  /** The client's tracing id, so server logs can be matched with client logs. */
  request_id?: string;
}

export type BreakTaskResult =
  | {
      success: true;
      empathyBridge?: string;
      firstStepHook?: string;
      stoppingPoint?: string;
      steps: BreakdownStep[];
      /** Id of the analytics row this breakdown was logged under, for later feedback. */
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

const KNOWN_REASONS = new Set<string>(Object.values(FallbackReason));

// The reason code comes from the network, so it is checked rather than cast.
function reasonFrom(value: unknown, otherwise: FallbackReason): FallbackReason {
  return typeof value === 'string' && KNOWN_REASONS.has(value)
    ? (value as FallbackReason)
    : otherwise;
}

function offlineResult(task: string): BreakTaskResult {
  return { success: true, steps: getOfflineFallbackSteps(task), source: 'offline' };
}

function failure(fallbackReason: FallbackReason, error: string): BreakTaskResult {
  return { success: false, fallbackReason, error };
}

// Without a tracing id the breakdown still works; only log correlation is lost.
function safeRequestId(): string | undefined {
  try {
    return newRequestId();
  } catch (error) {
    console.warn('Failed to generate a request id:', error);
    return undefined;
  }
}

function edgeFunctionUrl(): string | undefined {
  return (
    process.env.EXPO_PUBLIC_SUPABASE_EDGE_FUNCTION_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$|$/, '/functions/v1/break-task')
  );
}

/**
 * Breaks a task into steps through the break-task edge function.
 *
 * Never throws. Problems the user can act on (a rate limit, an expired session, a rejected
 * input, flagged content) come back as a failure with a reason. Everything else (no network,
 * a timeout, a server error, no backend configured) comes back as offline steps, because for
 * someone struggling to start, generic steps now beat an error message.
 */
export async function breakTask(input: string): Promise<BreakTaskResult> {
  const task = input.trim();
  const url = edgeFunctionUrl();
  if (!url) {
    return offlineResult(task);
  }

  const clientRequestId = safeRequestId();

  try {
    const {
      data: { session },
    } = await getSupabase().auth.getSession();
    if (!session) {
      return failure(FallbackReason.AUTH_EXPIRED, 'Not signed in');
    }

    // The Supabase gateway still expects the anon key as `apikey`; identity comes from the JWT.
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const payload: BreakTaskRequest = { input: task, request_id: clientRequestId };
    const response = await tracedAxios.post<BreakTaskResponse>(url, payload, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(anonKey ? { apikey: anonKey } : {}),
        ...(clientRequestId ? { 'x-request-id': clientRequestId } : {}),
      },
    });

    const data = response.data;
    // The response is still untrusted input: only well-formed steps make it into the app.
    const steps = normalizeSteps(data.breakdown?.steps);

    if (data.success && steps.length > 0) {
      return {
        success: true,
        empathyBridge: data.breakdown?.empathy_bridge,
        firstStepHook: data.breakdown?.first_step_hook,
        stoppingPoint: data.breakdown?.stopping_point,
        steps,
        requestId: data.meta?.request_id,
        source: data.meta?.source ?? 'model',
        promptVersion: data.meta?.prompt_version,
        tokenUsage: data.token_usage,
        latencyMs: data.latency_ms,
      };
    }

    // CONTENT_FLAGGED needs no payload: the panic screen renders its own localized content.
    return failure(
      reasonFrom(data.fallback_reason, FallbackReason.VALIDATION),
      data.error || 'Unknown error occurred'
    );
  } catch (error) {
    console.warn('breakTask API call failed:', error);
    const status = isAxiosError(error) ? error.response?.status : undefined;

    if (status === 429) {
      return failure(FallbackReason.RATE_DOWN, 'Too many requests');
    }
    if (status === 401) {
      return failure(FallbackReason.AUTH_EXPIRED, 'Session expired');
    }
    if (status !== undefined && status >= 400 && status < 500) {
      return failure(FallbackReason.VALIDATION, 'Request rejected');
    }
    return offlineResult(task);
  }
}
