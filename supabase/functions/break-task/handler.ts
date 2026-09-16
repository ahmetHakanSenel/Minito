import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import {
  bearerToken,
  corsHeaders,
  describeError,
  guardMethod,
  jsonResponse,
} from '../_shared/http.ts';
import type { Moderator } from './moderation.ts';
import {
  type BreakdownSource,
  languageEvidence,
  PROMPT_VERSION,
  runBreakdownPipeline,
  type TaskBreakdown,
} from './pipeline.ts';
import { createMeter, type ProviderAdapter, REQUEST_BUDGET_MS, withBudget } from './providers.ts';

/**
 * The break-task request handler. Every side effect (auth, quota, moderation, persistence, the
 * model itself) arrives through `BreakTaskDeps`, so the whole request path, ordering rules
 * included, is tested without a network or a database.
 *
 *   method guard → deployment readiness → JWT → body → moderation ∥ quota → pipeline → telemetry
 */

// Budget guards, not authorization: the JWT decides who may call, these decide how often.
export const RATE_LIMITS = {
  perIp: { max: 40, windowSeconds: 3600 },
  perUser: { max: 20, windowSeconds: 3600 },
} as const;

const MAX_DISPLAY_NAME_LENGTH = 30;

const CORS = corsHeaders(['POST'], ['x-request-id']);

export const RequestBodySchema = z.object({
  // trim() comes first on purpose: zod runs checks in order, so a whitespace-only task would
  // otherwise pass min(1) and reach the model as an empty string.
  input: z.string().trim().min(1).max(1000),
  // The client's own tracing id, kept for log correlation only. The id that feedback attaches
  // to is issued by the server, so no client can make two rows share one.
  request_id: z.string().uuid().optional(),
});

export type FallbackReason =
  'AI_DOWN' | 'MOD_DOWN' | 'RATE_DOWN' | 'VALIDATION' | 'CONTENT_FLAGGED';

export type ResponseBody = {
  success: boolean;
  breakdown?: TaskBreakdown;
  meta?: { prompt_version: string; source: BreakdownSource; request_id: string };
  fallback_reason?: FallbackReason;
  error?: string;
  token_usage?: number;
  latency_ms?: number;
};

/** One row of `tasks`. It never holds the task text: only its HMAC. */
export type TaskRecord = {
  request_id: string;
  user_id: string;
  input_hash: string;
  latency_ms: number;
  token_usage: number | null;
  fallback_reason: 'CONTENT_FLAGGED' | 'AI_DOWN' | null;
  ai_model?: string;
  prompt_version?: string;
  ai_latency_ms?: number;
  breakdown_source?: BreakdownSource;
  prompt_token_usage?: number;
  completion_token_usage?: number;
  cached_token_usage?: number;
  finish_reason?: string | null;
  response_language?: string | null;
  language_match?: boolean | null;
  validation_issues?: string[] | null;
  steps?: TaskBreakdown['steps'];
};

export type AuthenticatedUser = { id: string; metadata: Record<string, unknown> };

export type LogLevel = 'info' | 'warn' | 'error';

/** Structured logging. Fields carry ids, counts and durations: never task text or model output. */
export type Logger = (level: LogLevel, event: string, fields: Record<string, unknown>) => void;

export type BreakTaskDeps = {
  /** null: no usable provider is configured. */
  provider: ProviderAdapter | null;
  /** null: moderation is not configured. */
  moderator: Moderator | null;
  /** The deployment's explicit, logged decision to serve requests without moderation. */
  allowUnmoderated: boolean;
  /**
   * Resolves null for anon, expired and malformed tokens alike. Throws when Auth itself cannot
   * answer, which must not be mistaken for "signed out".
   */
  authenticate: (token: string) => Promise<AuthenticatedUser | null>;
  /** One atomic check-and-consume. Resolves true when the request still fits the quota. */
  consumeQuota: (
    identifier: string,
    maxRequests: number,
    windowSeconds: number
  ) => Promise<boolean>;
  /** Keyed hash (HMAC) used for everything that must be countable but not readable. */
  hash: (value: string) => Promise<string>;
  persistTask: (record: TaskRecord) => Promise<void>;
  /** Keeps work alive after the reply without delaying it. */
  runInBackground: (work: Promise<unknown>) => void;
  clientIp: (req: Request) => string | null;
  log: Logger;
  now?: () => number;
  newRequestId?: () => string;
};

// The name is user-controlled text headed into a prompt: keep it short, single-line and inert.
export function sanitizeDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .replace(/\p{Cc}/gu, '')
    .replace(/["`\\{}<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DISPLAY_NAME_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

function displayNameOf(user: AuthenticatedUser): string | null {
  const { display_name, full_name, name } = user.metadata;
  return sanitizeDisplayName(display_name ?? full_name ?? name);
}

// The header is caller-controlled and only ever logged, so it is kept opaque and short.
const SAFE_CLIENT_ID = /^[A-Za-z0-9._:-]{1,64}$/;

function clientRequestIdOf(req: Request, bodyId: string | undefined): string | null {
  if (bodyId) return bodyId;
  const header = req.headers.get('x-request-id');
  return header && SAFE_CLIENT_ID.test(header) ? header : null;
}

/**
 * Checks the IP quota, then the user quota. Sequential on purpose: a request the IP quota turns
 * away never spends the user's quota. A quota check that errors is skipped (fail open) and
 * logged, because a database hiccup should not lock every user out of a budget guard.
 */
async function withinQuota(
  deps: BreakTaskDeps,
  userId: string,
  ipHash: string | null,
  context: Record<string, unknown>
): Promise<boolean> {
  const scopes = [
    ...(ipHash ? [{ scope: 'ip', identifier: `ip:${ipHash}`, ...RATE_LIMITS.perIp }] : []),
    { scope: 'user', identifier: `user:${userId}`, ...RATE_LIMITS.perUser },
  ];

  for (const { scope, identifier, max, windowSeconds } of scopes) {
    let granted: boolean;
    try {
      granted = await deps.consumeQuota(identifier, max, windowSeconds);
    } catch (error) {
      deps.log('error', 'break_task.quota_check_failed', {
        ...context,
        scope,
        error: describeError(error),
      });
      continue;
    }
    if (!granted) {
      deps.log('warn', 'break_task.rate_limited', { ...context, scope, limit: max });
      return false;
    }
  }
  return true;
}

export function createBreakTaskHandler(deps: BreakTaskDeps): (req: Request) => Promise<Response> {
  const now = deps.now ?? Date.now;
  const newRequestId = deps.newRequestId ?? (() => crypto.randomUUID());

  return async (req) => {
    const rejected = guardMethod(req, ['POST'], CORS);
    if (rejected) return rejected;

    const startTime = now();
    const requestId = newRequestId();
    const headers = { ...CORS, 'x-request-id': requestId };
    const reply = (body: ResponseBody, status: number) => jsonResponse(body, status, headers);

    try {
      // Deployment problems are answered before authentication, so the client's anonymous
      // health probe reports a misconfigured function as down instead of as a healthy 401.
      if (!deps.provider) {
        deps.log('error', 'break_task.provider_unconfigured', { request_id: requestId });
        return reply(
          { success: false, fallback_reason: 'AI_DOWN', error: 'AI service is not configured' },
          503
        );
      }
      if (!deps.moderator && !deps.allowUnmoderated) {
        deps.log('error', 'break_task.moderation_unconfigured', { request_id: requestId });
        return reply(
          {
            success: false,
            fallback_reason: 'MOD_DOWN',
            error: 'Content moderation is not configured',
          },
          503
        );
      }

      const token = bearerToken(req);
      let user: AuthenticatedUser | null;
      try {
        user = token ? await deps.authenticate(token) : null;
      } catch (error) {
        // A 401 here would make every client drop its session during an Auth outage.
        deps.log('error', 'break_task.auth_unavailable', {
          request_id: requestId,
          error: describeError(error),
        });
        return reply({ success: false, error: 'Authentication is temporarily unavailable' }, 503);
      }
      if (!user) {
        return reply({ success: false, error: 'Unauthorized' }, 401);
      }

      const parsed = RequestBodySchema.safeParse(await req.json().catch(() => undefined));
      if (!parsed.success) {
        return reply(
          {
            success: false,
            fallback_reason: 'VALIDATION',
            error: `Validation error: ${parsed.error.issues
              .map((issue) => `${issue.path.join('.') || '(body)'}: ${issue.message}`)
              .join(', ')}`,
          },
          400
        );
      }

      const context = {
        request_id: requestId,
        client_request_id: clientRequestIdOf(req, parsed.data.request_id),
      };
      const task = parsed.data.input.replace(/\s+/g, ' ');
      const ip = deps.clientIp(req);
      // The domain prefix keeps IP hashes from ever colliding with input hashes.
      const [inputHash, ipHash] = await Promise.all([
        deps.hash(task),
        ip ? deps.hash(`ip:${ip}`) : Promise.resolve(null),
      ]);
      const recordBase = { request_id: requestId, user_id: user.id, input_hash: inputHash };

      // Independent gates, so they run together. The client renders crisis content in the
      // user's own locale from the reason code alone: never ship crisis copy from here.
      const [moderation, allowed] = await Promise.all([
        deps.moderator ? deps.moderator(task) : Promise.resolve(null),
        withinQuota(deps, user.id, ipHash, context),
      ]);

      if (moderation && !moderation.checked) {
        deps.log('warn', 'break_task.moderation_skipped', {
          ...context,
          reason: moderation.reason,
        });
      }

      // Safety wins over quota: telling someone in crisis that they are out of requests is the
      // wrong answer, whichever gate tripped.
      if (moderation?.flagged) {
        deps.log('info', 'break_task.content_flagged', context);
        deps.runInBackground(
          deps.persistTask({
            ...recordBase,
            token_usage: null,
            latency_ms: now() - startTime,
            fallback_reason: 'CONTENT_FLAGGED',
          })
        );
        return reply({ success: false, fallback_reason: 'CONTENT_FLAGGED' }, 200);
      }

      if (!allowed) {
        return reply(
          {
            success: false,
            fallback_reason: 'RATE_DOWN',
            error: 'Too many requests. Please try again later.',
          },
          429
        );
      }

      const provider = deps.provider;
      const meter = createMeter();
      const result = await runBreakdownPipeline(
        withBudget(provider, startTime + REQUEST_BUDGET_MS, meter),
        { task, displayName: displayNameOf(user) }
      );

      // ai_latency_ms is model time only; latency_ms stays end-to-end, and the gap is our overhead.
      const telemetry = {
        ai_model: provider.model,
        prompt_version: PROMPT_VERSION,
        ai_latency_ms: meter.aiLatencyMs,
      };

      if (!result) {
        const latencyMs = now() - startTime;
        deps.log('warn', 'break_task.ai_down', {
          ...context,
          ai_model: provider.model,
          ai_latency_ms: meter.aiLatencyMs,
          latency_ms: latencyMs,
        });
        deps.runInBackground(
          deps.persistTask({
            ...recordBase,
            ...telemetry,
            token_usage: null,
            latency_ms: latencyMs,
            fallback_reason: 'AI_DOWN',
          })
        );
        return reply(
          {
            success: false,
            fallback_reason: 'AI_DOWN',
            error: 'AI service is temporarily unavailable. Please try again later.',
          },
          503
        );
      }

      const { breakdown, source, tokens, finishReason, issues } = result;
      const latencyMs = now() - startTime;
      // A fallback plan's language comes from our own heuristic, so comparing it with that same
      // heuristic would always agree. Only the model's own choice is worth scoring, and only
      // against real evidence: a one-word task is not scored at all.
      const responseLanguage = source === 'fallback' ? null : breakdown.language;
      const expectedLanguage = languageEvidence(task);
      const languageMatch =
        responseLanguage === null || expectedLanguage === null
          ? null
          : responseLanguage === expectedLanguage;

      deps.log(source === 'model' ? 'info' : 'warn', 'break_task.completed', {
        ...context,
        ai_model: provider.model,
        source,
        token_usage: tokens.total,
        prompt_tokens: tokens.prompt,
        completion_tokens: tokens.completion,
        cached_tokens: tokens.cached,
        finish_reason: finishReason,
        response_language: responseLanguage,
        language_match: languageMatch,
        ai_latency_ms: meter.aiLatencyMs,
        latency_ms: latencyMs,
        ...(issues.length > 0 ? { validation_issues: issues } : {}),
      });

      // Persistence stays off the reply path: its retries once pushed finished plans past the
      // client's 20 s ceiling, and the user saw offline steps for a breakdown already paid for.
      deps.runInBackground(
        deps.persistTask({
          ...recordBase,
          ...telemetry,
          token_usage: tokens.total,
          prompt_token_usage: tokens.prompt,
          completion_token_usage: tokens.completion,
          cached_token_usage: tokens.cached,
          finish_reason: finishReason ?? null,
          response_language: responseLanguage,
          language_match: languageMatch,
          // Which rule the first reply broke, so a prompt is fixed by evidence rather than guess.
          validation_issues: issues.length > 0 ? issues : null,
          latency_ms: latencyMs,
          breakdown_source: source,
          fallback_reason: null,
          steps: breakdown.steps,
        })
      );

      return reply(
        {
          success: true,
          breakdown,
          meta: { prompt_version: PROMPT_VERSION, source, request_id: requestId },
          token_usage: tokens.total,
          latency_ms: latencyMs,
        },
        200
      );
    } catch (error) {
      // Details stay in the logs; the client only learns that the server failed.
      deps.log('error', 'break_task.unhandled_error', {
        request_id: requestId,
        error: describeError(error),
      });
      return reply({ success: false, error: 'Internal server error' }, 500);
    }
  };
}
