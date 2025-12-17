# Supabase Setup Guide

## 1. Database Schema Setup

Run the migration SQL in your Supabase Dashboard:

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `migrations/001_initial_schema.sql`
3. Run the migration

This will create:
- `system_prompts` table with unique active index
- `tasks` table with privacy-first design (input_hash only, no raw input)
- Indexes for performance
- Data retention function (cleanup_old_tasks)

## 2. Insert Initial System Prompt

After running the migration, insert a default system prompt:

```sql
INSERT INTO system_prompts (prompt_text, is_active) 
VALUES (
  'You are a helpful assistant that breaks down tasks into clear, actionable steps. Return only a JSON array of step strings, no other text. Each step should be concise and actionable. Example: ["Step 1 description", "Step 2 description", "Step 3 description"]',
  true
);
```

## 3. Deploy Edge Function

1. Install Supabase CLI (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Deploy the function:
   ```bash
   supabase functions deploy break-task
   ```

## 4. Configure Edge Function Environment Variables

In Supabase Dashboard → Edge Functions → break-task → Settings:

- `OPENAI_API_KEY`: Your OpenAI API key
- `HMAC_SECRET`: A strong random secret for HMAC hashing (generate with: `openssl rand -hex 32`)
- `SUPABASE_URL`: Automatically set
- `SUPABASE_SERVICE_ROLE_KEY`: Automatically set

## 5. Frontend Configuration

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_SUPABASE_EDGE_FUNCTION_URL=https://your-project-ref.supabase.co/functions/v1/break-task
```

## 6. Test the Setup

You can test the edge function using the frontend API:

```typescript
import { breakTask } from '@/src/lib/api';
import { getOrCreateGuestId } from '@/src/lib/guestIdentity';

const guestId = await getOrCreateGuestId();
const result = await breakTask('Learn React Native', guestId);

if (result.success) {
  console.log('Steps:', result.steps);
} else {
  console.log('Fallback reason:', result.fallbackReason);
  if (result.panicKit) {
    console.log('Panic kit:', result.panicKit);
  }
}
```

## Data Retention

The `cleanup_old_tasks()` function deletes tasks older than 90 days. You can:

1. Run it manually:
   ```sql
   SELECT cleanup_old_tasks();
   ```

2. Set up a scheduled job (requires pg_cron extension):
   - Enable pg_cron in Supabase Dashboard
   - Uncomment the cron.schedule line in the migration file
   - Re-run that part of the migration















