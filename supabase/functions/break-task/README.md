# break-task Edge Function

This Supabase Edge Function breaks down user tasks into actionable steps using OpenAI or Gemini.
Only signed-in users can call it.

## Setup

1. Apply the migrations in `supabase/migrations` (009 adds `tasks.user_id` and 010 adds `tasks.client_ip_hash`; rate limiting relies on both).

2. Set secrets (`supabase secrets set NAME=value`):
   - `HMAC_SECRET` (required): key for HMAC-SHA256 input hashing, e.g. `openssl rand -hex 32`. The function refuses to run without it.
   - `AI_PROVIDER`: `openai` (default) or `gemini`
   - `OPENAI_API_KEY`: required for the OpenAI provider and for moderation
   - `GEMINI_API_KEY` / `GEMINI_MODEL`: required for the Gemini provider
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: set automatically by Supabase

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
- `Authorization: Bearer <user-access-token>` (required; anon-key or expired tokens get `401`)

**Request Body:**
```json
{
  "input": "Learn React Native",
  "guest_id": "uuid-here",
  "request_id": "uuid-here"
}
```

**Success Response:**
```json
{
  "success": true,
  "empathy_bridge": "…",
  "first_step_hook": "…",
  "steps": ["Step 1", "Step 2", "Step 3"],
  "token_usage": 150,
  "latency_ms": 1234
}
```

**Error Response (Content Flagged):**
```json
{
  "success": false,
  "fallback_reason": "CONTENT_FLAGGED"
}
```
The client renders the panic kit in the user's own locale; the server never ships crisis copy.

## Implementation Details

- **Authentication**: The bearer token must belong to a signed-in user; the user's display name personalizes the reply
- **Fail-Soft Philosophy**: Provider and persistence failures are handled gracefully, never blocking UX
- **Privacy**: Input is hashed with HMAC-SHA256, never stored in raw form
- **Moderation**: Fail-Safe - if flagged, returns `CONTENT_FLAGGED` (requires `OPENAI_API_KEY`)
- **Rate Limiting**: 20 requests/hour per authenticated user and 40/hour per client IP (`429 RATE_DOWN`); the IP is stored only as an HMAC. Checks fail open only if the query itself errors
- **Client IP**: Taken from `cf-connecting-ip`, then `x-real-ip`, then the first `x-forwarded-for` hop (caller-controlled, so best-effort only)
- **Caching**: System prompt cached for 60 seconds
- **Retries**: AI calls retry 3 times with exponential backoff
- **Persistence**: Task records retry 3 times, failures are logged but don't block response
