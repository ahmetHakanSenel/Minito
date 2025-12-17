# break-task Edge Function

This Supabase Edge Function breaks down user tasks into actionable steps using OpenAI.

## Setup

1. Deploy the function to Supabase:
   ```bash
   supabase functions deploy break-task
   ```

2. Set environment variables in Supabase Dashboard:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `HMAC_SECRET`: Secret key for HMAC hashing (use a strong random string)
   - `SUPABASE_URL`: Automatically set by Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: Automatically set by Supabase

## API

**Endpoint:** `https://<project-ref>.supabase.co/functions/v1/break-task`

**Method:** POST

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <anon-key>` (optional, if using RLS)

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
  "steps": ["Step 1", "Step 2", "Step 3"],
  "token_usage": 150,
  "latency_ms": 1234
}
```

**Error Response (Content Flagged):**
```json
{
  "success": false,
  "fallback_reason": "CONTENT_FLAGGED",
  "panic_kit": {
    "headline": "Bu içeriği güvenlik nedeniyle gösteremiyoruz",
    "steps": [...]
  }
}
```

## Implementation Details

- **Fail-Soft Philosophy**: All failures are handled gracefully, never blocking UX
- **Privacy**: Input is hashed with HMAC_SHA256, never stored in raw form
- **Moderation**: Fail-Safe - if flagged, returns panic kit
- **Rate Limiting**: Fail-Soft - logs but doesn't block
- **Caching**: System prompt cached for 60 seconds
- **Retries**: OpenAI calls retry 3 times with exponential backoff
- **Persistence**: Task records retry 3 times, failures are logged but don't block response















