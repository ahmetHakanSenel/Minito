# break-task

Turns one overwhelming task into a validated, structured plan of micro-steps. Only signed-in users
can call it. Setup and secrets are covered in [`docs/SETUP.md`](../../../docs/SETUP.md), and
operations in [`docs/RUNBOOK.md`](../../../docs/RUNBOOK.md).

## Files

| File | Responsibility |
| ---- | -------------- |
| `index.ts` | Wiring only: turns secrets and the service-role client into the handler's dependencies |
| `handler.ts` | The request path: method guard, readiness, auth, body, moderation and quota, pipeline, telemetry |
| `pipeline.ts` | The AI pipeline: layered prompt, output contract, validation, one repair, deterministic fallback |
| `providers.ts` | OpenAI and Gemini adapters, with the timeout, retry and model-time policy |
| `moderation.ts` | OpenAI moderation, with its own timeout and a fail-open verdict that says it failed open |
| `*.test.ts` | Deno tests for each of the above. Run them with `npm run test:edge` |

Every side effect reaches `handler.ts` through `BreakTaskDeps`. That is what lets
`handler.test.ts` cover the whole request path, ordering rules included, without a network or a
database.

## Request path

```
POST ─► method guard ─► readiness ─► JWT ─► body ─┬─► moderation ─┬─► pipeline ─► reply
                         (503)       (401)  (400) └─► IP quota,   ┘                │
                                                      user quota                   └─► telemetry row
                                                      (429)                            (after reply)
```

1. **Readiness** is checked before auth, so the app's anonymous health probe sees a
   misconfigured deployment (`503 AI_DOWN` / `503 MOD_DOWN`) instead of a healthy-looking `401`.
2. **Auth.** A token that Auth rejects gets `401`. If Auth itself is unreachable, the answer is
   `503`: a `401` would tell every client to sign out.
3. **Body.** `input` is trimmed, then checked for 1–1000 characters, in that order, so a
   whitespace-only task never reaches the model.
4. **Moderation and quota** run in parallel.
   - The IP quota is checked before the user quota, so a request refused by IP never spends the
     user's allowance.
   - A flagged input wins over an exhausted quota.
   - Both fail open, and every failure is logged.
5. **Pipeline.** Generate, validate, at most one repair, then the deterministic fallback, all
   inside a 17 s budget.
6. **Telemetry** is written after the reply, kept alive with `EdgeRuntime.waitUntil`. The insert
   is idempotent: `request_id` is unique.

## API

`POST /functions/v1/break-task`

| Header | Value |
| ------ | ----- |
| `Authorization` | `Bearer <user access token>` (required) |
| `apikey` | The anon key (required by the Supabase gateway) |
| `x-request-id` | Optional client tracing id, logged as `client_request_id` |

```json
{ "input": "Learn React Native", "request_id": "3f8e…" }
```

`request_id` is optional and only correlates logs. The server issues its own id and returns it in
`meta.request_id` and in the `x-request-id` response header; feedback must use that one.

**200, a plan**

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
  "meta": { "prompt_version": "task-breakdown-v2", "source": "model", "request_id": "b1c2…" },
  "token_usage": 612,
  "latency_ms": 3120
}
```

`meta.source` says where the plan came from:

- `model`: the first reply was valid.
- `repaired`: the reply was valid after one repair.
- `fallback`: the deterministic plan was used.

**Other answers**

| Status | Body | Meaning |
| ------ | ---- | ------- |
| 200 | `{ "success": false, "fallback_reason": "CONTENT_FLAGGED" }` | The app shows its support screen, in the user's own language |
| 400 | `fallback_reason: "VALIDATION"` | The body was invalid |
| 401 | `error: "Unauthorized"` | No user, or a rejected token |
| 405 | | Not a POST |
| 429 | `fallback_reason: "RATE_DOWN"` | A quota was exhausted: 40/h per IP, 20/h per user |
| 503 | `fallback_reason: "AI_DOWN"` or `"MOD_DOWN"`, or no reason for Auth | A dependency is down or not configured |
| 500 | `error: "Internal server error"` | A bug. Details are only in the logs |

## Prompt and contract

- **Prompt.** Five layers (Identity, Rules, Tone, Decomposition, Output Contract) are joined into
  one system prompt, versioned as `PROMPT_VERSION`. Bump the version whenever the prompt or the
  contract changes.
- **Fence.** The task goes inside `<task_input>` and the display name inside `<user_name>`. Every
  angle bracket in either value becomes a look-alike character (`‹ ›`), so neither can open or
  close a tag, however the tag is spelled.
- **Display name.** Read from the verified JWT, never from the body. It is stripped of control
  characters, quotes, backticks, braces and brackets, and capped at 30 characters.
- **Contract (zod).**
  - 3–7 steps with unique ids.
  - The first step is `easy`.
  - `estimated_minutes` is between 1 and 10.
  - Every string has a length cap.
- **Repair and fallback.** A reply that breaks the contract gets one repair request carrying the
  issues, with no transport retries. If that also fails, the task's language gets a deterministic
  plan, which is itself validated at module load.
- **Log safety.** Validation issues are logged and stored, so they are rewritten to never quote
  the model's output.

## Time budget

| Limit | Value | Why |
| ----- | ----- | --- |
| Client timeout | 20 s | Past this, offline steps beat waiting |
| Request budget | 17 s | Generation plus one repair, inside the client's limit |
| Per provider call | 9 s | Leaves room for a retry within the budget |
| Moderation call | 3 s | A slow safety check must not eat the model's time |
| Transport retries | 1, on the first generation only | Network errors and 5xx. A `429` is never retried |
