# break-task Edge Function

This Supabase Edge Function turns one overwhelming task into a validated, structured micro-step plan using OpenAI or Gemini.
Only signed-in users can call it.

## Files

- `index.ts`: HTTP handler covering auth, moderation, rate limits, providers, the time budget and persistence.
- `pipeline.ts`: the AI pipeline: layered prompt, output contract, validation, repair and fallback. It has no HTTP or storage dependencies.
- `providers.ts`: the OpenAI and Gemini adapters, plus the timeout, retry and model-time measurement policy wrapped around them.
- `pipeline.test.ts` / `providers.test.ts`: Deno tests. Run them with `deno test --no-lock supabase/functions/`; CI runs them too.

## Setup

1. Apply the migrations in `supabase/migrations`. Migration 009 adds `tasks.user_id` and 010 adds `tasks.client_ip_hash`; rate limiting relies on both.

2. Set secrets (`supabase secrets set NAME=value`):
   - `HMAC_SECRET` (required): key for HMAC-SHA256 input hashing, e.g. `openssl rand -hex 32`. The function refuses to run without it.
   - `AI_PROVIDER`: `openai` (default) or `gemini`.
   - `OPENAI_MODEL`: optional, defaults to `gpt-4o-mini`. Swapping it by deploy makes model comparisons possible through the `ai_model` column.
   - `ALLOW_UNMODERATED`: optional escape hatch, `true` only. Without `OPENAI_API_KEY` the function refuses to run (`503 MOD_DOWN`) unless this is set, so moderation can never be dropped silently by choosing a different provider.
   - `OPENAI_API_KEY`: required for the OpenAI provider and for moderation.
   - `GEMINI_API_KEY` / `GEMINI_MODEL`: required for the Gemini provider.
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: set automatically by Supabase.

3. Deploy the function:
   ```bash
   supabase functions deploy break-task
   ```

## API

**Endpoint:** `https://<project-ref>.supabase.co/functions/v1/break-task`

**Method:** POST

**Headers:**

- `Content-Type: application/json`
- `apikey: <anon-key>`
- `Authorization: Bearer <user-access-token>`: required. Anon-key or expired tokens get `401`.

**Request Body:**

```json
{
  "input": "Learn React Native",
  "guest_id": "uuid-here",
  "request_id": "uuid-here"
}
```

**Success Response** (output contract `task-breakdown-v2`):

```json
{
  "success": true,
  "breakdown": {
    "language": "en",
    "empathy_bridge": "…",
    "first_step_hook": "…",
    "steps": [
      {
        "id": "step-1",
        "title": "Open the course page",
        "instruction": "Open the first lesson and read only its title.",
        "estimated_minutes": 2,
        "difficulty": "easy"
      }
    ],
    "stopping_point": "…"
  },
  "meta": { "prompt_version": "task-breakdown-v2", "source": "model" },
  "token_usage": 612,
  "latency_ms": 3120
}
```

The value of `meta.source` is one of:

- `model`: the first reply was valid.
- `repaired`: the reply was valid after one repair request.
- `fallback`: the deterministic plan was used.

**Error Response (Content Flagged):**

```json
{
  "success": false,
  "fallback_reason": "CONTENT_FLAGGED"
}
```

The client renders the panic kit in the user's own locale; the server never ships crisis copy.

## AI Pipeline

1. **Layered prompt:** Five layers are joined into one system prompt: Identity, Rules, Tone, Decomposition and Output Contract. The prompt is versioned by `PROMPT_VERSION`; bump it whenever the prompt or the contract changes.
2. **Fenced input:**
   - The task is wrapped in `<task_input>` and the display name in `<user_name>`.
   - Those tags are stripped from the values themselves, so the input cannot close its own fence.
   - The Rules layer tells the model to treat fenced text as data. It must ignore role changes, instruction overrides and schema-bypass attempts found there.
3. **Generate:** The request uses provider JSON mode: OpenAI `response_format: json_object`, or Gemini `responseMimeType: application/json`.
4. **Validate:** The reply goes through `JSON.parse`, then the zod `TaskBreakdownSchema`. The contract requires:
   - 3 to 7 steps with unique ids.
   - The first step's difficulty is `easy`. A plan that opens with a hard step hands the paralysis straight back, so this is a contract rule rather than prompt advice.
   - `estimated_minutes` between 1 and 10.
   - Length caps on every string.
5. **Repair:** If validation fails, exactly one follow-up request is sent, carrying the validation issues. It has no transport retries.
6. **Fallback:** If the repair also fails, a deterministic, schema-valid plan is returned in the task's language. These plans are validated at module load.

If the provider cannot be reached at all, the function answers `503 AI_DOWN` instead, and the client falls back to its own offline steps.

## Implementation Details

- **Authentication:** The bearer token must belong to a signed-in user. The user's display name personalizes the reply.
- **Time budget:**
  - The whole request, including one repair, runs inside a 17s budget that fits under the client's 20s timeout.
  - Each provider call is capped at 9s.
  - The first generation gets one transport retry, on network errors and 5xx responses only; a 429 is not retried.
- **Telemetry:** Every answered request writes one `tasks` row carrying `ai_model`, `prompt_version`, `ai_latency_ms` (model time only, measured with `performance.now()` and including failed attempts), `latency_ms` (end to end), `token_usage` (prompt + completion) and `breakdown_source`. The user's later score lands on the same row as `feedback_score`, written through `submit_breakdown_feedback()` (migration 012).
- **Request id:** The client sends its tracing id in the body so it can score that row later; the `x-request-id` header is the fallback for clients that only trace by header.
- **Logging:** Log lines are structured JSON tagged with `prompt_version`, `source`, `ai_model`, latencies and any validation issues. They never include the task text or the model's reply.
- **Privacy:** Input is hashed with HMAC-SHA256 and never stored in raw form.
- **Moderation:** Fail-safe and mandatory. It runs in parallel with the rate-limit check, and a flagged input wins over an exhausted quota: telling someone in crisis that they are out of requests would be the wrong answer. It needs `OPENAI_API_KEY` whichever provider writes the plan (see `ALLOW_UNMODERATED`).
- **Rate Limiting:**
  - 20 requests/hour per authenticated user and 40/hour per client IP (`429 RATE_DOWN`).
  - The IP is stored only as an HMAC.
  - Checks fail open only if the query itself errors.
- **Client IP:** Taken from `cf-connecting-ip`, then `x-real-ip`, then the first `x-forwarded-for` hop. That hop is caller-controlled, so this is best-effort only.
- **Legacy table:** `system_prompts` is no longer read. A runtime-editable prompt could silently break the output contract.
- **Persistence:** The telemetry row is written **after** the reply is sent, kept alive by `EdgeRuntime.waitUntil`, and retried 3 times. Its retries used to run first and could push a finished plan past the client's 20s ceiling, so the user saw offline steps for a breakdown that had already been paid for. A row that is lost after all retries is logged as `break_task.telemetry_lost`.
