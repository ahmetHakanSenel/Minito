# Setup

From an empty machine to a running app and a deployed backend. A Turkish version lives in
[`SETUP.tr.md`](./SETUP.tr.md).

## Prerequisites

| Tool | Used for |
| ---- | -------- |
| Node.js 22 | The app, Jest, the database tests |
| Docker | The database tests, and type generation from the migrations |
| A Supabase project | Auth, Postgres, Edge Functions |
| An OpenAI API key | Plan generation and content moderation (Gemini can write plans instead) |

The Supabase CLI and Deno run through `npx`; nothing else needs a global install.

## 1. The app

```bash
npm install
cp .env.example .env    # fill in the Supabase URL and anon key
npm start
```

Email sign-in works in Expo Go. Google sign-in needs a development build
(`npx expo run:android`), because Expo Go lacks its native module.

Without a `.env`, the app still boots: it starts signed out, the login screen explains that the
backend is not configured, and breakdowns fall back to offline steps.

## 2. The backend

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push                       # applies supabase/migrations in order
```

Set the function secrets:

```bash
npx supabase secrets set HMAC_SECRET="$(openssl rand -hex 32)"
npx supabase secrets set OPENAI_API_KEY=sk-...
```

| Secret | Required | Meaning |
| ------ | -------- | ------- |
| `HMAC_SECRET` | Yes | Key for every stored hash. The function refuses to start without it. Rotating it breaks deduplication of older rows and nothing else |
| `OPENAI_API_KEY` | Yes, unless `ALLOW_UNMODERATED=true` | Plan generation with OpenAI, and moderation whichever provider writes the plan |
| `AI_PROVIDER` | No | `openai` (default) or `gemini` |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | With Gemini | `GEMINI_MODEL` defaults to `gemini-2.0-flash` |
| `ALLOW_UNMODERATED` | No | `true` serves requests without moderation. Without it, a deployment that has no OpenAI key answers `503 MOD_DOWN` |
| `OPS_ALERTS_SECRET`, `ALERT_WEBHOOK_URL`, `ALERT_WEBHOOK_FORMAT` | No | Operational alerts, off unless a webhook is set. See [RUNBOOK.md](./RUNBOOK.md#alert-delivery) |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform.

Deploy the functions:

```bash
npx supabase functions deploy break-task
npx supabase functions deploy delete-user
npx supabase functions deploy export-user-data
# Optional: operational alerts (see RUNBOOK.md)
npx supabase functions deploy ops-alerts --no-verify-jwt
```

### Upgrading an existing project past migration 014

Migration 015 drops columns that `break-task` versions older than 014 still write. Apply the two in
order, with a deploy between them (expand, deploy, contract):

1. Apply `014_atomic_rate_limits.sql`.
2. Deploy `break-task`.
3. Apply `015_harden_schema.sql`.

`supabase db push` applies both at once, which is only safe on a project that has no running
function yet. [`RUNBOOK.md`](./RUNBOOK.md#deploying) has the full procedure and the rollback.

## 3. Sign-in providers

Email sign-in needs no setup. The native providers hand the app an ID token, which is exchanged
with `supabase.auth.signInWithIdToken`.

**Google**

1. In Google Cloud, create an OAuth client of type **Web application**. Put its client ID in
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
2. Create an **Android** OAuth client with the app's package name (`android.package` in `app.json`) and the
   SHA-1 of the signing key (`npx expo run:android` prints the debug one, and EAS shows the
   release one).
3. In Supabase, go to **Authentication → Providers → Google**. Enter the web client ID and secret,
   and add the web client ID under **Authorized Client IDs**.

**Apple** (iOS only)

1. Enable **Sign in with Apple** for the app's bundle ID in the Apple Developer portal.
2. In Supabase, go to **Authentication → Providers → Apple** and add the bundle ID as a client ID.
3. Set `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=true`.

## 4. Scheduled jobs

Retention and quota cleanup are plain SQL functions. With the `pg_cron` extension enabled:

```sql
SELECT cron.schedule('cleanup-old-tasks', '0 3 * * *', 'SELECT public.cleanup_old_tasks();');
SELECT cron.schedule('cleanup-rate-limits', '17 * * * *', 'SELECT public.cleanup_rate_limits();');
SELECT cron.schedule('cleanup-planner-tombstones', '40 3 * * *', 'SELECT public.cleanup_planner_tombstones();');
```

## 5. Checking the deployment

```bash
# An anonymous request must be refused before any AI work: expect 401.
# A 503 means the function is deployed but misconfigured; its body names the reason.
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/break-task" \
  -H "apikey: <anon-key>" -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" -d '{}'
```

Then create a breakdown in the app, and run query 1 of
[`ops/telemetry-queries.sql`](./ops/telemetry-queries.sql): the request shows up there with its
prompt version, model, latency and tokens.

## 6. Development checks

| Command | What it checks |
| ------- | -------------- |
| `npm run typecheck` | TypeScript, strict |
| `npm run lint` | ESLint, with zero warnings allowed |
| `npm run format:check` | Prettier |
| `npm test` | Jest: repositories, API client, session storage, locales, UI logic |
| `npm run test:edge` | Deno: the edge function handler, AI pipeline, providers and moderation |
| `npm run test:db` | Postgres: migrations, RLS, grants, quota concurrency, the ops queries |
| `npm run gen:types` | Regenerates `database.types.ts` from the migrations (run `test:db` first) |
| `npm run eval:ai -- --dry-run` | The offline evaluation harness, without a provider |

`test:db` needs a Postgres it may create databases in:

```bash
docker run -d --name minito-test-db -e POSTGRES_PASSWORD=postgres -p 54329:5432 postgres:15-alpine
npm run test:db
```
