import { isBackendConfigured } from '../supabase/client';

export type ProbeResult = {
  /** HTTP status, or null when the request never got an answer (offline, DNS, timeout). */
  status: number | null;
  latencyMs: number | null;
};

const PROBE_TIMEOUT_MS = 5000;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const breakTaskUrl =
  process.env.EXPO_PUBLIC_SUPABASE_EDGE_FUNCTION_URL ??
  (supabaseUrl ? `${supabaseUrl}/functions/v1/break-task` : undefined);

async function timedRequest(url: string, init: RequestInit): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { status: response.status, latencyMs: Date.now() - startedAt };
  } catch {
    return { status: null, latencyMs: null };
  } finally {
    clearTimeout(timeout);
  }
}

/** Supabase's auth health endpoint proves the cloud API answers without touching user data. */
export function probeCloudApi(): Promise<ProbeResult> | null {
  if (!isBackendConfigured || !supabaseUrl || !anonKey) {
    return null;
  }
  return timedRequest(`${supabaseUrl}/auth/v1/health`, { headers: { apikey: anonKey } });
}

/**
 * break-task rejects an anon-key request before doing any AI work, so a quick 4xx proves the
 * function is deployed and answering without spending AI budget.
 */
export function probeAiGateway(): Promise<ProbeResult> | null {
  if (!isBackendConfigured || !breakTaskUrl || !anonKey) {
    return null;
  }
  return timedRequest(breakTaskUrl, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
}
