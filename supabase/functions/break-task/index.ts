import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  createClient,
  type SupabaseClient,
  type User,
} from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { PROMPT_VERSION, runBreakdownPipeline, TaskBreakdownSchema } from './pipeline.ts';
import { createMeter, REQUEST_BUDGET_MS, resolveProvider, withBudget } from './providers.ts';

/**
 * Edge Function: break-task
 *
 * Turns one overwhelming task into a validated, structured micro-step plan with OpenAI or Gemini.
 * The AI pipeline itself (prompt, validation, repair, fallback) lives in ./pipeline.ts, and the
 * provider adapters with their timeout and retry budget live in ./providers.ts.
 *
 * Steps:
 * 0. Authenticate the caller (a signed-in user JWT is required)
 * 1. Sanitize input & HMAC-SHA256 hash for privacy
 * 2. Moderation (Fail-Safe) → if flagged, return CONTENT_FLAGGED
 * 3. Per-user and per-IP rate limits (enforced; fail open only if a check itself errors)
 * 4. AI pipeline → generate, validate, one repair, deterministic fallback, all inside a time budget
 * 5. Persistence → one telemetry row per request (retry 3x), which the user's feedback later scores
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-request-id, x-guest-id',
};

// Zod schemas for validation
const RequestBodySchema = z.object({
  input: z.string().min(1).max(1000).trim(),
  guest_id: z.string().uuid().optional(),
  request_id: z.string().uuid().optional(),
});

const ResponseBodySchema = z.object({
  success: z.boolean(),
  breakdown: TaskBreakdownSchema.optional(),
  meta: z
    .object({
      prompt_version: z.string(),
      source: z.enum(['model', 'repaired', 'fallback']),
    })
    .optional(),
  fallback_reason: z.string().optional(),
  error: z.string().optional(),
  token_usage: z.number().int().nonnegative().optional(),
  latency_ms: z.number().int().nonnegative().optional(),
});

type RequestBody = z.infer<typeof RequestBodySchema>;
type ResponseBody = z.infer<typeof ResponseBodySchema>;

function jsonResponse(body: ResponseBody, status: number): Response {
  // Validate response (fail-soft: log but never block the reply)
  try {
    ResponseBodySchema.parse(body);
  } catch (validationError) {
    console.warn('Response validation warning:', validationError);
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required secret: ${name}`);
  }
  return value;
}

/**
 * Structured log line tagged with the prompt version. Never pass the task text or the model's
 * reply: both can carry personal data.
 */
function logEvent(level: 'info' | 'warn', event: string, fields: Record<string, unknown>): void {
  const write = level === 'warn' ? console.warn : console.log;
  write(JSON.stringify({ event, prompt_version: PROMPT_VERSION, ...fields }));
}

/**
 * Resolve the signed-in user behind the request's bearer token.
 * Anon-key and expired tokens resolve to null and are rejected by the caller.
 */
async function authenticate(req: Request, supabase: SupabaseClient): Promise<User | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

let hmacKeyPromise: Promise<CryptoKey> | null = null;

function getHmacKey(secret: string): Promise<CryptoKey> {
  hmacKeyPromise ??= crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return hmacKeyPromise;
}

/**
 * HMAC-SHA256 of the sanitized input, so analytics can dedupe without storing the text.
 */
async function hashInput(sanitizedInput: string, secret: string): Promise<string> {
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sanitizedInput));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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

// The header is caller-controlled and lands in an analytics column, so it is kept opaque and short.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/;

/**
 * The tracing id this request is logged under. The client sends it in the body so it can attach
 * feedback to the row later; the header is the fallback for clients that only trace by header.
 */
function traceId(req: Request, bodyRequestId: string | undefined): string | null {
  if (bodyRequestId) return bodyRequestId;
  const header = req.headers.get('x-request-id');
  return header && SAFE_REQUEST_ID.test(header) ? header : null;
}

/**
 * Check moderation (Fail-Safe)
 * If content is flagged, return fallback panic kit
 */
async function checkModeration(
  input: string,
  openaiKey: string
): Promise<{ flagged: boolean; reason?: string }> {
  // The moderation endpoint is OpenAI-only; without a key there is nothing to call.
  if (!openaiKey) {
    console.warn('OPENAI_API_KEY not set, skipping moderation');
    return { flagged: false };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    });

    if (!response.ok) {
      // Fail-safe: if moderation fails, assume safe (don't block user)
      console.warn('Moderation API failed, assuming safe:', response.statusText);
      return { flagged: false };
    }

    const data = await response.json();
    const flagged = data.results?.[0]?.flagged === true;

    return {
      flagged,
      reason: flagged ? 'CONTENT_FLAGGED' : undefined,
    };
  } catch (error) {
    // Fail-safe: if moderation fails, assume safe
    console.error('Moderation check error:', error);
    return { flagged: false };
  }
}

// Per-hour ceilings. The user quota is keyed by the verified user id, so it cannot be dodged by
// rotating client-supplied identifiers; the IP quota stops one address from farming free accounts.
const RATE_LIMIT_PER_USER = 20;
const RATE_LIMIT_PER_IP = 40;

type RateLimitScope = {
  column: 'user_id' | 'client_ip_hash';
  value: string;
  limit: number;
};

async function exceedsLimit(
  supabase: SupabaseClient,
  scope: RateLimitScope,
  since: string
): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq(scope.column, scope.value)
      .gte('created_at', since);

    if (error) {
      console.error(`Rate limit check on ${scope.column} failed, allowing request:`, error);
      return false;
    }
    if ((count ?? 0) >= scope.limit) {
      console.warn(
        `Rate limit exceeded on ${scope.column}: ${count} in last hour (limit ${scope.limit})`
      );
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Rate limit check on ${scope.column} errored, allowing request:`, error);
    return false;
  }
}

/**
 * Check rate limits (enforced).
 * Fail-soft only on infrastructure errors: if a check itself cannot run,
 * the request is allowed rather than blocking a legitimate user.
 */
async function checkRateLimit(
  userId: string,
  ipHash: string | null,
  supabase: SupabaseClient
): Promise<{ limited: boolean }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const scopes: RateLimitScope[] = [
    { column: 'user_id', value: userId, limit: RATE_LIMIT_PER_USER },
  ];
  if (ipHash) {
    scopes.push({ column: 'client_ip_hash', value: ipHash, limit: RATE_LIMIT_PER_IP });
  }

  const results = await Promise.all(
    scopes.map((scope) => exceedsLimit(supabase, scope, oneHourAgo))
  );
  return { limited: results.some(Boolean) };
}

const MAX_DISPLAY_NAME_LENGTH = 30;

// The name is user-controlled text headed into a prompt: keep it short, single-line and inert.
function sanitizeDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .replace(/\p{Cc}/gu, '')
    .replace(/["`\\{}<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DISPLAY_NAME_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

function displayNameOf(user: User): string | null {
  const metadata = user.user_metadata ?? {};
  return sanitizeDisplayName(metadata.display_name ?? metadata.full_name ?? metadata.name);
}

/**
 * Main handler
 */
serve(async (req: Request) => {
  const startTime = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Missing secrets are a deployment error: fail loudly instead of degrading to defaults.
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const hmacSecret = requireEnv('HMAC_SECRET');
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || '';
    const aiProvider = (Deno.env.get('AI_PROVIDER') || 'openai').toLowerCase();
    // Available models: gemini-2.0-flash, gemini-2.0-flash-001, gemini-2.5-flash, gemini-2.5-pro
    const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash';

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Step 0: Only signed-in users may spend the AI budget.
    const user = await authenticate(req, supabase);
    if (!user) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    // An unknown provider or a missing key is a deployment problem: let the client fall back.
    const provider = resolveProvider(aiProvider, { openaiKey, geminiKey, geminiModel });
    if (!provider) {
      console.warn(`AI provider "${aiProvider}" is unknown or has no API key. Skipping AI call.`);
      return jsonResponse(
        { success: false, fallback_reason: 'AI_DOWN', error: 'AI provider not configured' },
        503
      );
    }

    // Parse and validate request body with Zod
    let body: RequestBody;
    try {
      body = RequestBodySchema.parse(await req.json());
    } catch (validationError) {
      return jsonResponse(
        {
          success: false,
          fallback_reason: 'VALIDATION',
          error:
            validationError instanceof z.ZodError
              ? `Validation error: ${validationError.errors
                  .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                  .join(', ')}`
              : 'Invalid request body',
        },
        400
      );
    }

    const { input, guest_id, request_id } = body;
    const requestId = traceId(req, request_id);
    const ipAddress = clientIp(req);
    // The domain prefix keeps IP hashes from ever colliding with input hashes.
    const ipHash = ipAddress ? await hashInput(`ip:${ipAddress}`, hmacSecret) : null;
    const taskRecordBase = {
      user_id: user.id,
      client_ip_hash: ipHash,
      guest_id: guest_id || null,
      request_id: requestId,
    };

    // Step 1: Sanitize input & HMAC-SHA256 hash
    const sanitizedInput = input.trim().replace(/\s+/g, ' ');
    const inputHash = await hashInput(sanitizedInput, hmacSecret);

    // Step 2: Moderation (Fail-Safe)
    // The server sends only the reason code — the client renders panic-kit
    // content in the user's own locale. Never ship crisis copy from here.
    const moderationResult = await checkModeration(sanitizedInput, openaiKey);
    if (moderationResult.flagged) {
      supabase
        .from('tasks')
        .insert({
          ...taskRecordBase,
          input_hash: inputHash,
          token_usage: null,
          latency_ms: Date.now() - startTime,
          fallback_reason: 'CONTENT_FLAGGED',
        })
        .then(
          () => {},
          (err: unknown) => console.warn('Failed to persist task:', err)
        );

      return jsonResponse({ success: false, fallback_reason: 'CONTENT_FLAGGED' }, 200);
    }

    // Step 3: Rate Limit check (enforced)
    // Rate-limited attempts are NOT persisted to `tasks`, so a blocked
    // user's retries never extend their own block window.
    const { limited } = await checkRateLimit(user.id, ipHash, supabase);
    if (limited) {
      return jsonResponse(
        {
          success: false,
          fallback_reason: 'RATE_DOWN',
          error: 'Too many requests. Please try again later.',
        },
        429
      );
    }

    // Step 4: AI pipeline (generate → validate → one repair → deterministic fallback)
    const meter = createMeter();
    const result = await runBreakdownPipeline(
      withBudget(provider, startTime + REQUEST_BUDGET_MS, meter),
      { task: sanitizedInput, displayName: displayNameOf(user) }
    );

    // Telemetry that makes a quality change traceable to the model and prompt that produced it.
    // ai_latency_ms is model time only; latency_ms stays end-to-end, and the gap is our overhead.
    const telemetry = {
      ai_model: provider.model,
      prompt_version: PROMPT_VERSION,
      ai_latency_ms: meter.aiLatencyMs,
    };

    if (!result) {
      logEvent('warn', 'break_task.ai_down', {
        provider: aiProvider,
        ai_model: provider.model,
        request_id: requestId,
        ai_latency_ms: meter.aiLatencyMs,
        latency_ms: Date.now() - startTime,
      });
      supabase
        .from('tasks')
        .insert({
          ...taskRecordBase,
          ...telemetry,
          input_hash: inputHash,
          token_usage: null,
          latency_ms: Date.now() - startTime,
          fallback_reason: 'AI_DOWN',
        })
        .then(
          () => {},
          (err: unknown) => console.warn('Failed to persist task:', err)
        );

      return jsonResponse(
        {
          success: false,
          fallback_reason: 'AI_DOWN',
          error: 'AI service is temporarily unavailable. Please try again later.',
        },
        503
      );
    }

    const { breakdown, source, tokenUsage, issues } = result;
    const latencyMs = Date.now() - startTime;
    logEvent(source === 'model' ? 'info' : 'warn', 'break_task.completed', {
      provider: aiProvider,
      ai_model: provider.model,
      source,
      request_id: requestId,
      token_usage: tokenUsage,
      ai_latency_ms: meter.aiLatencyMs,
      latency_ms: latencyMs,
      ...(issues.length > 0 ? { validation_issues: issues } : {}),
    });

    // Step 5: Persistence (with retry, fail-soft)
    for (let persistAttempt = 1; persistAttempt <= 3; persistAttempt++) {
      try {
        const { error } = await supabase.from('tasks').insert({
          ...taskRecordBase,
          ...telemetry,
          input_hash: inputHash,
          token_usage: tokenUsage,
          latency_ms: latencyMs,
          breakdown_source: source,
          fallback_reason: null,
          steps: breakdown.steps,
        });
        if (!error) break;
        console.warn(`Persistence attempt ${persistAttempt} failed:`, error);
      } catch (error) {
        console.warn(`Persistence attempt ${persistAttempt} failed:`, error);
      }
      if (persistAttempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * persistAttempt));
      }
    }

    return jsonResponse(
      {
        success: true,
        breakdown,
        meta: { prompt_version: PROMPT_VERSION, source },
        token_usage: tokenUsage,
        latency_ms: latencyMs,
      },
      200
    );
  } catch (error) {
    // Details stay in the logs; the client only learns that the server failed.
    console.error('Edge function error:', error);
    return jsonResponse(
      { success: false, error: 'Internal server error', fallback_reason: 'DB_DOWN' },
      500
    );
  }
});
