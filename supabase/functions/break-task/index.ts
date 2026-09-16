import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.89.0';
import { corsHeaders, describeError, jsonResponse, requireEnv } from '../_shared/http.ts';
import { createAdminClient, resolveUser } from '../_shared/supabase.ts';
import {
  type BreakTaskDeps,
  createBreakTaskHandler,
  type LogLevel,
  type TaskRecord,
} from './handler.ts';
import { openAiModerator } from './moderation.ts';
import { PROMPT_VERSION } from './pipeline.ts';
import { DEFAULT_OPENAI_MODEL, resolveProvider } from './providers.ts';

/**
 * Edge Function: break-task
 *
 * Wiring only. The request path lives in ./handler.ts, the AI pipeline (prompt, validation,
 * repair, fallback) in ./pipeline.ts, and the provider adapters with their time budget in
 * ./providers.ts. This file turns secrets and the service-role client into those dependencies.
 */

/** One JSON object per line, tagged with the prompt version, so logs can be queried as data. */
function logEvent(level: LogLevel, event: string, fields: Record<string, unknown>): void {
  const write = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  write(JSON.stringify({ level, event, prompt_version: PROMPT_VERSION, ...fields }));
}

/**
 * Keeps the isolate alive for work that must finish but must not delay the reply.
 * Falls back to a detached promise where the runtime has no waitUntil (local `deno run`).
 */
function runInBackground(work: Promise<unknown>): void {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (typeof runtime?.waitUntil === 'function') {
    runtime.waitUntil(work);
    return;
  }
  work.catch(() => {});
}

const PERSIST_ATTEMPTS = 3;
const UNIQUE_VIOLATION = '23505';

/**
 * Telemetry is best-effort: a few short retries, then one log line that says it was lost.
 * request_id is unique, which makes the retry idempotent: when an insert succeeded but its
 * acknowledgement was lost, the retry hits the constraint, and that means the row is there.
 */
async function persistWithRetry(admin: SupabaseClient, record: TaskRecord): Promise<void> {
  for (let attempt = 1; attempt <= PERSIST_ATTEMPTS; attempt++) {
    try {
      const { error } = await admin.from('tasks').insert(record);
      if (!error || error.code === UNIQUE_VIOLATION) return;
      logEvent('warn', 'break_task.telemetry_retry', {
        request_id: record.request_id,
        attempt,
        error: `${error.code}: ${error.message}`,
      });
    } catch (error) {
      logEvent('warn', 'break_task.telemetry_retry', {
        request_id: record.request_id,
        attempt,
        error: describeError(error),
      });
    }
    if (attempt < PERSIST_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  logEvent('error', 'break_task.telemetry_lost', {
    request_id: record.request_id,
    attempts: PERSIST_ATTEMPTS,
  });
}

/** HMAC-SHA256 via Web Crypto; the key is imported once per isolate. */
function createHmacHasher(secret: string): (value: string) => Promise<string> {
  const key = crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return async (value) => {
    const signature = await crypto.subtle.sign('HMAC', await key, new TextEncoder().encode(value));
    return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join(
      ''
    );
  };
}

/**
 * Best-effort client IP. Cloudflare sets cf-connecting-ip itself, whereas the first
 * x-forwarded-for hop is caller-controlled, so it only serves as a fallback.
 */
function clientIp(req: Request): string | null {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (
    req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? (forwardedFor || null)
  );
}

function buildDeps(): BreakTaskDeps {
  // Missing secrets are a deployment error: fail loudly instead of degrading to defaults.
  const admin = createAdminClient();
  const hmacSecret = requireEnv('HMAC_SECRET');
  const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
  const providerName = (Deno.env.get('AI_PROVIDER') || 'openai').toLowerCase();
  // Moving to the Gemini 2.5 family means capping its thinking budget, or latency and cost jump.
  const provider = resolveProvider(providerName, {
    openaiKey,
    openaiModel: Deno.env.get('OPENAI_MODEL') || DEFAULT_OPENAI_MODEL,
    geminiKey: Deno.env.get('GEMINI_API_KEY') || '',
    geminiModel: Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash',
  });
  // Moderation runs on OpenAI's endpoint whichever model writes the plan. Without a key it is
  // skipped only when the deployment says so out loud.
  const allowUnmoderated = Deno.env.get('ALLOW_UNMODERATED') === 'true';
  if (!openaiKey && allowUnmoderated) {
    logEvent('warn', 'break_task.running_unmoderated', { provider: providerName });
  }

  return {
    provider,
    moderator: openaiKey ? openAiModerator(openaiKey) : null,
    allowUnmoderated,
    authenticate: async (token) => {
      const user = await resolveUser(admin, token);
      return user ? { id: user.id, metadata: user.user_metadata ?? {} } : null;
    },
    consumeQuota: async (identifier, maxRequests, windowSeconds) => {
      const { data, error } = await admin.rpc('check_and_consume_quota', {
        p_identifier: identifier,
        p_max_requests: maxRequests,
        p_window_interval: `${windowSeconds} seconds`,
      });
      if (error) throw new Error(`${error.code}: ${error.message}`);
      return data === true;
    },
    hash: createHmacHasher(hmacSecret),
    persistTask: (record) => persistWithRetry(admin, record),
    runInBackground,
    clientIp,
    log: logEvent,
  };
}

let handler: ((req: Request) => Promise<Response>) | null = null;

Deno.serve(async (req) => {
  try {
    // Built on first use, and rebuilt on the next request if the configuration was broken.
    handler ??= createBreakTaskHandler(buildDeps());
  } catch (error) {
    logEvent('error', 'break_task.misconfigured', { error: describeError(error) });
    return jsonResponse(
      { success: false, error: 'Internal server error' },
      500,
      corsHeaders(['POST'])
    );
  }
  return handler(req);
});
