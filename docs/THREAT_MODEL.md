# Threat model

What Minito protects, from whom, and where each claim is enforced and tested. A claim with no
test next to it is a claim to be skeptical of, so the last column matters most.

## Assets

| Asset | Why it matters |
| ----- | -------------- |
| The AI budget | Every breakdown costs money. An open endpoint is an open wallet |
| Users' task text and plans | Tasks describe people's lives: health, money, work, family |
| Sessions | A stolen session reads a user's history and can delete their account |
| The output contract | The app renders what the model returns; a broken contract is a broken screen |
| Service credentials | The service role key bypasses RLS; provider keys spend money |

## Trust boundaries

```
 untrusted                 │ semi-trusted             │ trusted
───────────────────────────┼──────────────────────────┼──────────────────────────────
 the app, its storage,     │ PostgREST + RLS          │ Edge Functions (service role)
 anything sent over HTTP,  │ (anon / authenticated)   │ Postgres functions with
 the model's output        │                          │ SECURITY DEFINER
```

The model sits outside the trust boundary in both directions. User text sent to it is fenced as
data. Its reply is validated as untrusted input on the server and again in the app.

## Threats and controls

| # | Threat | Control | Evidence |
| - | ------ | ------- | -------- |
| T1 | **Budget drain by concurrency.** Many parallel requests all pass a count-then-write limit | `check_and_consume_quota` checks and consumes in one `INSERT … ON CONFLICT` statement, serialized by the row lock | `database.test.mjs`: 60 concurrent calls grant exactly 20, for new and existing counters |
| T2 | **Budget drain by account cycling.** Delete the account, sign up again, repeat | Quota counters live in `rate_limits`, which has no link to `auth.users`; there is also a per-IP quota | `database.test.mjs`: counters survive account deletion |
| T3 | **Spending someone else's quota.** A client calls the quota function with another user's identifier | The function is executable only by `service_role` | `database.test.mjs`: anon and authenticated get `42501` |
| T4 | **Anonymous AI use** | `break-task` requires a user JWT verified by Auth. The anon key gets `401` before any work | `handler.test.ts`: no quota, moderation or model call without a user |
| T5 | **Prompt injection that escapes the data fence** | Every `<` and `>` in user text becomes a look-alike character, so no tag can be written, however it is nested or spaced | `pipeline.test.ts`: nested and spaced tag attacks leave exactly one fence |
| T6 | **Prompt injection that stays inside the fence** | The Rules layer declares fenced text inert. The output must match a strict schema, so a successful injection still yields only a short, schema-valid plan | `pipeline.test.ts`: contract and repair tests |
| T7 | **Hostile model output** reaching the UI | Server-side zod validation, one repair, then a deterministic plan. The app re-validates every step (`normalizeSteps`) | `pipeline.test.ts`, `breakTask.test.ts`, `breakdownSteps.test.ts` |
| T8 | **Reading other users' data** | RLS on every table. `task_breakdowns` is owner-only; `tasks` and `rate_limits` have no client policies at all | `database.test.mjs`: cross-user select, insert, update and delete |
| T9 | **Tampering with telemetry or scoring others' plans** | `tasks` is closed to clients. Feedback goes only through `submit_breakdown_feedback`, which matches the row by request id **and** `auth.uid()` | `database.test.mjs`: a foreign request id scores nothing |
| T10 | **Colliding feedback ids** | The server issues `request_id`, and it is unique in `tasks` | `database.test.mjs`, `handler.test.ts` |
| T11 | **Search-path hijacking** of privileged functions | Every function in `public` pins `search_path`, and the privileged ones pin it to empty | `database.test.mjs`: a schema-wide check fails on any function without one |
| T12 | **Supabase default grants** re-opening what a migration meant to close | Migrations revoke from `anon` and `authenticated` explicitly, not only from `PUBLIC` | `bootstrap.sql` reproduces Supabase's default grants. Deleting the explicit revoke makes two tests fail (checked by hand) |
| T13 | **Sensitive text in logs or analytics** | Task text is stored only as an HMAC. Logs carry ids, counts and durations. Validation messages are rewritten so they never quote model output. Provider error bodies are truncated | `handler.test.ts`: neither the stored record nor the logs contain the task; `pipeline.test.ts`: issues never quote the model's value |
| T14 | **Session theft from device storage** | The session is AES-256 encrypted with a fresh key per write. The key lives in the Keychain or Keystore | `secureSessionStorage.test.ts` |
| T15 | **Losing the session through a crash or a race** between the two stores | Ordered writes, where the envelope names its own key, plus the Supabase client's process lock | `secureSessionStorage.test.ts`: a crash at each step leaves a readable session |
| T16 | **Mass sign-out during an Auth outage** | Only a token that Auth rejects yields `401`. An unreachable Auth yields `503` | `supabase.test.ts`, `handler.test.ts` |
| T17 | **Harmful content** | OpenAI moderation, with safety ranked above quota. A deployment without a moderation key refuses to serve unless it opts out explicitly | `handler.test.ts`, `moderation.test.ts` |
| T18 | **Leaked credentials in the repository** | gitleaks scans the full history in CI. Known placeholder values are allowlisted by fingerprint | CI `secrets` job |
| T19 | **Keeping data without a purpose** | IP hashes and guest ids were dropped once nothing used them. Telemetry has a 90-day retention job. Export and deletion cover every owned row | `database.test.mjs`: dropped columns and cascade tests |
| T20 | **Anyone triggering or probing the alert function** | It requires its own secret, compared in constant time, and returns only rule names. The snapshot function and the alert state are closed to clients | `ops-alerts/handler.test.ts`, `database.test.mjs` |
| T21 | **Attaching a planner task to someone else's project** | A composite foreign key `(project_id, user_id)` on top of RLS | `database.test.mjs`. Replacing the composite key with a plain one makes the test fail (checked by hand) |
| T22 | **Overwriting another user's planner row with an upsert** | Upserts are subject to the update policy on the existing row | `database.test.mjs` |
| T23 | **A stale or badly clocked device overwriting newer edits** | A trigger skips older writes and clamps device clocks to server time plus one minute | `database.test.mjs` |

## Accepted risks

These are known, deliberate and documented. Each has a trigger for when it should be revisited.

| Risk | Why it is accepted | Revisit when |
| ---- | ------------------ | ------------ |
| **Quota and moderation fail open** | A database or safety-service hiccup should not lock out someone who is struggling to start. The provider account's spend limit is the hard backstop | Spend limits are unavailable, or the app serves minors |
| **Fixed quota window** | At a window boundary, up to twice the limit can pass in a short burst. One row and one statement per identifier is worth that | Abuse shows up at window boundaries in Q6 |
| **Client IP is best-effort** | The first `x-forwarded-for` hop is caller-controlled when the platform's own headers are missing. The per-user quota does not depend on it | The per-IP quota becomes the main defense |
| **AES-CTR without an integrity tag** | It protects confidentiality. An attacker who can already write the app's private storage has more direct attacks available | The platform offers authenticated encryption for this pattern |
| **No nonce on Apple ID tokens** | Tokens are short-lived and bound to the app's client ID | Apple sign-in ships to production (iOS is not release-configured yet) |
| **Plans are kept in telemetry** | Judging a prompt version means reading what it produced. The rows are closed to clients, exported on request, deleted with the account, and expire after 90 days | A plan could identify a person more than its task hash can |
| **Last write wins in the planner** | Concurrent edits to the same row from two devices resolve by edit time, not by merging fields. A planner row is a title or a checkbox, so a merge would not add much | Planner items gain richer fields |
| **Moderation needs OpenAI even with Gemini** | One moderation implementation, applied whichever model writes the plan | A second provider's moderation is needed |
