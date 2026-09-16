# Runbook

How Minito's backend is expected to behave, how to tell when it does not, and what to do about
it. The queries referenced as **Q1–Q7** live in [`ops/telemetry-queries.sql`](./ops/telemetry-queries.sql)
and run in the Supabase SQL editor. CI runs every one of them against the current schema, so they
stay valid as the schema changes.

## The request path, and where it can fail

```
app ──► break-task ──► JWT check ──► moderation ∥ quota ──► model (≤ 2 calls) ──► reply
                                          │         │              │                │
                                     OpenAI mod.  Postgres    OpenAI / Gemini   telemetry row
                                                                                (after reply)
```

| Dependency | If it fails | What the user sees |
| ---------- | ----------- | ------------------ |
| Supabase Auth | `503`, logged as `auth_unavailable`. Only a token Auth actually rejects gets `401` | Offline steps; nobody is signed out |
| Postgres (quota) | Quota check fails open, logged as `quota_check_failed` | Nothing |
| Postgres (telemetry) | Row retried 3 times, then `telemetry_lost` | Nothing |
| OpenAI moderation | Fails open after 3 s, logged as `moderation_skipped` | Nothing |
| Model provider | `503 AI_DOWN` after the 17 s budget | Offline steps and a quiet notice |
| The model's output | One repair, then a deterministic plan | A generic but usable plan |

The client waits at most 20 s. The server's 17 s budget, including one repair, leaves room to
answer within that limit.

## Service level objectives

Measured from the `tasks` table over a rolling 28 days. A flagged request is a correct refusal,
so it counts neither as good nor as bad.

| SLI | Definition | SLO | Query |
| --- | ---------- | --- | ----- |
| Availability | Requests answered with a plan ÷ eligible requests | 99% | Q2, Q3 |
| Latency | Answered requests with `latency_ms` ≤ 12 000 ÷ answered requests | 95% | Q2 |
| Quality | Plans from the model (`model` or `repaired`) ÷ answered requests | 97% | Q1, Q2 |

How the targets were chosen:

- **Availability, 99%.** The app degrades to offline steps, so an outage costs quality, not
  function. A tighter target would mostly measure the model provider's own SLA.
- **Latency, 12 s.** The offline evaluation measured p95 model time at 6.5 s for one call. 12 s
  leaves room for a retry, but not for a repair round-trip on top of a slow first call. That case
  is rare, and the 17 s budget still ends it inside the client's limit.
- **Quality, 97%.** The evaluation measured 100% first-try validity on 20 tasks. A sample that
  small cannot support a tighter claim.

**Error budget.** At 99% availability, 1 in 100 requests may fail over 28 days. Q3 shows how much
of that budget remains. When it runs out, stop prompt and model experiments until it recovers:
those are the changes most likely to spend it.

## Signals

Every server log line is one JSON object with `level` and `event`. `break-task` lines also carry
`prompt_version`, and the handler's lines carry `request_id` (issued by the server) and
`client_request_id` (the app's tracing id). Search the Edge Function logs by `event`.

| Event | Level | Meaning | Action |
| ----- | ----- | ------- | ------ |
| `break_task.completed` | info / warn | A plan was returned. `warn` when `source` is `repaired` or `fallback` | Watch the warn ratio (Q1) |
| `break_task.ai_attempt_failed` | warn | One provider call failed or timed out | Expected occasionally. A burst means the playbook [Provider outage](#provider-outage) |
| `break_task.ai_budget_exhausted` | warn | No time left for another attempt | Same as above |
| `break_task.ai_down` | warn | The provider never answered; the user got `503` | [Provider outage](#provider-outage) |
| `break_task.rate_limited` | warn | A quota refused a request (`scope`: `ip` or `user`) | [Quota pressure](#quota-pressure) |
| `break_task.quota_check_failed` | error | The quota check errored and the request was allowed | [Quota check failing](#quota-check-failing) |
| `break_task.moderation_skipped` | warn | Moderation did not run (`reason`: `timeout`, `http_429`, ...) | [Moderation degraded](#moderation-degraded) |
| `break_task.moderation_unconfigured` | error | No moderation key, and unmoderated serving is not allowed | Set `OPENAI_API_KEY` |
| `break_task.provider_unconfigured` | error | `AI_PROVIDER` names no provider with a key | Fix the secrets |
| `break_task.running_unmoderated` | warn | Logged once per isolate when there is no moderation key and `ALLOW_UNMODERATED=true` | Confirm this is intended |
| `break_task.auth_unavailable` | error | Supabase Auth could not verify a token; the user got `503`, not `401` | Check Auth health in the dashboard |
| `break_task.misconfigured` | error | A required secret is missing; every request gets `500` | Set the secret named in `error` |
| `break_task.content_flagged` | info | Moderation flagged the input | None; the app shows its support screen |
| `break_task.telemetry_retry` / `telemetry_lost` | warn / error | The telemetry row could not be written | [Telemetry gaps](#telemetry-gaps) |
| `break_task.unhandled_error` | error | A bug. The user got a generic `500` | Reproduce from `error`, add a handler test |
| `ops_alerts.evaluated` | info / warn | One alert run; `firing` lists the rules, `notified` what was sent | None |
| `ops_alerts.delivery_disabled` | info | Rules were evaluated, but no webhook is configured | None, unless delivery is wanted |
| `ops_alerts.failed` | error | The snapshot, the state or the webhook failed; the next run retries | Check `error` |

### Alerts

The `ops-alerts` function evaluates these rules against `ops_health_snapshot()`. The thresholds
live in [`rules.ts`](../supabase/functions/ops-alerts/rules.ts), and Deno tests pin them down.

| Rule | Fires when | Minimum sample | Severity |
| ---- | ---------- | -------------- | -------- |
| `availability` | Under 95% of requests answered with a plan, last hour | 20 requests | Page |
| `quality` | Under 90% of plans came from the model, last hour | 20 plans | Ticket |
| `latency` | Under 90% of plans arrived within 12 s, last hour | 20 plans | Ticket |
| `error_budget` | More failures than the 99% SLO allows, last 28 days | 100 requests | Ticket; freeze prompt and model changes |
| `spend` | Today's tokens exceed 3 × the 7-day daily average | 50 000 tokens | Ticket |

The minimum samples keep a quiet hour from paging anyone: at three requests, one failure reads
as 67% availability.

A rule notifies a person three times: when it starts firing, every 6 hours while it keeps firing,
and when it resolves. The state lives in `ops_alert_state`, and it is saved only after the message
was delivered. If delivery fails, the next run tries again.

Log-based conditions are not covered by `ops-alerts`. Watch for them in the log explorer:

- Any `misconfigured`, `provider_unconfigured` or `moderation_unconfigured` event (page).
- More than 10 `quota_check_failed` events in 10 minutes (page: spend is unguarded).

### Alert delivery

Delivery is **off by default**: without `ALERT_WEBHOOK_URL` the function only evaluates the rules
and logs `ops_alerts.delivery_disabled`. To switch it on:

1. Create a webhook (a Discord channel webhook, or a Slack incoming webhook) and set the secrets:

   ```bash
   npx supabase secrets set OPS_ALERTS_SECRET="$(openssl rand -hex 32)"
   npx supabase secrets set ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/...
   npx supabase secrets set ALERT_WEBHOOK_FORMAT=discord   # or slack
   npx supabase functions deploy ops-alerts --no-verify-jwt
   ```

   `--no-verify-jwt` is correct here: the caller is a scheduler, and the function checks
   `OPS_ALERTS_SECRET` itself, in constant time.

2. Schedule it every 15 minutes with `pg_cron` and `pg_net`, keeping the URL and the secret in
   Vault:

   ```sql
   SELECT vault.create_secret('https://<project-ref>.supabase.co/functions/v1/ops-alerts', 'ops_alerts_url');
   SELECT vault.create_secret('<OPS_ALERTS_SECRET>', 'ops_alerts_secret');

   SELECT cron.schedule('ops-alerts', '*/15 * * * *', $$
     SELECT net.http_post(
       url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ops_alerts_url'),
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ops_alerts_secret')
       ),
       body := '{}'::jsonb
     );
   $$);
   ```

To switch delivery off again, unset `ALERT_WEBHOOK_URL`. The schedule can stay in place.

## Playbooks

### Provider outage

**Symptoms:** `ai_down` and `ai_attempt_failed` rise, and Q2 `available` drops.

1. Check the provider's status page. Look at `error` in `ai_attempt_failed`: `TimeoutError` means
   the provider is slow, `OpenAI API error: 5xx` means it is down, and `429` means our quota is
   exhausted.
2. Switch provider without a code change:
   `npx supabase secrets set AI_PROVIDER=gemini`, then redeploy `break-task` so every isolate
   picks it up. Moderation keeps running on the OpenAI key.
3. If the cause is a `429`, raise the account's limit. The retry policy deliberately does not
   retry a `429`.

Users keep getting offline steps throughout, so this is a quality incident, not an outage of the
app.

### Quality regression after a prompt or model change

**Symptoms:** Q1 shows `repair_rate` or `fallback_rate` rising for the newest `prompt_version`,
or `helpful_rate` falling in Q7.

1. Q4 names the contract rule that breaks most often. `truncated` > 0 in Q1 means the output
   ceiling (`MAX_OUTPUT_TOKENS`) is too low for the new prompt.
2. Roll back by redeploying the previous commit of `break-task`. `PROMPT_VERSION` separates
   the two versions in every query.
3. Before trying again, reproduce the failure offline: `npm run eval:ai`, then compare the new
   result file with the committed baseline in `docs/eval/results/`.

### Quota pressure

**Symptoms:** `rate_limited` rises.

- Q6 splits it by scope. Many `ip` rows at the limit while the `user` count is flat means one
  address is cycling accounts. That is the quota doing its job.
- If real users are being refused, raise the limit in `RATE_LIMITS`
  (`supabase/functions/break-task/handler.ts`) and deploy.
- To lift one counter immediately, delete its row:
  `DELETE FROM public.rate_limits WHERE identifier = 'user:<uuid>';`

### Quota check failing

**Symptoms:** `quota_check_failed`.

The quota fails open, so while this lasts, spend is limited only by the provider account's own
limit.

1. Check database health in the Supabase dashboard. `error` holds the PostgREST code:
   `PGRST202` means `check_and_consume_quota` is missing, so migration 014 was not applied.
2. If the outage continues, set a hard monthly spend limit on the provider account. That limit is
   the backstop for exactly this case.

### Moderation degraded

**Symptoms:** `moderation_skipped`.

Moderation fails open by design: for someone who is stuck, a slow safety service must not block
the app. `reason: timeout` in bulk means the moderation endpoint is slow; `http_401` means the key
was revoked. Rotate the key (see [Secrets](#secrets)) or wait out the provider incident. If
unmoderated serving must not continue, remove `OPENAI_API_KEY`: the function then answers
`503 MOD_DOWN` and the app falls back to offline steps.

### Telemetry gaps

**Symptoms:** `telemetry_lost`, or Q2 counts well below the request volume in the function logs.

Telemetry never blocks a reply, so gaps have no user impact. They do skew the SLIs, because a lost
row is neither good nor bad. The insert is idempotent (`request_id` is unique), so retries cannot
double-count. Sustained loss points at database health; see the dashboard.

## Deploying

**Functions** deploy with `npx supabase functions deploy <name>`. To roll back, check out the
previous commit and deploy again.

**Migrations** only go forward. Before a migration that drops data (015 is one), take a backup or
note the point-in-time-recovery timestamp.

A migration that removes something the running function still uses must ship in three steps:

1. **Expand.** Apply a migration that only adds (014 adds the quota table and function).
2. **Deploy** the function that uses the new objects and stops using the old ones.
3. **Contract.** Apply the migration that removes the old objects (015 drops the old columns).

After a deploy:

- An anonymous probe returns `401` (see [SETUP.md](./SETUP.md#5-checking-the-deployment)).
- One real breakdown appears in Q1 under the expected `prompt_version` and `ai_model`.
- No `misconfigured` event appears in the logs.

## Secrets

| Secret | How to rotate | Side effects |
| ------ | ------------- | ------------ |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | Create a new key, `supabase secrets set`, redeploy, revoke the old key | None |
| `HMAC_SECRET` | `supabase secrets set`, redeploy | Hashes of older rows no longer match new ones, so dedup and per-IP counters restart. Nothing else reads them |
| Service role key | Roll it in the dashboard; the platform re-injects it | None for the functions |

### Planner sync problems

Planner sync runs on the device, so it leaves no server logs. Its guarantees are covered by tests
instead (`src/features/planner/__tests__`, and the planner block of `database.test.mjs`):

- **A report of lost edits.** Edits stay in the device's pending queue until the server confirms
  them. A row the server rejects (a constraint) stays on that device only, and the app logs
  `Planner sync: the server rejected …`.
- **A report of a deleted project coming back.** The server skips any write older than the
  stored row, so an offline device cannot resurrect a newer tombstone. A device that stays offline
  for longer than the tombstone retention (30 days, `cleanup_planner_tombstones()`) recreates the
  row it edited. That is the intended failure: recreating a row is safer than losing an edit.

## Data requests

- **Access and portability:** The app's privacy screen calls `export-user-data`. The export
  contains the account, the saved breakdowns and the AI request log.
- **Erasure:** `delete-user` deletes the auth user, and every owned row cascades with it. Quota
  counters are kept on purpose: they are keyed by id, hold no content, and expire within a day
  once the cleanup job runs.
- **Retention:** Once scheduled (see [SETUP.md](./SETUP.md#4-scheduled-jobs)):
  - `cleanup_old_tasks()` deletes request telemetry older than 90 days.
  - `cleanup_planner_tombstones()` purges planner deletions after 30 days.
- **Planner:** It is part of the export. Deleting the account removes the server copy through the
  cascade, and the app removes the device copy.
