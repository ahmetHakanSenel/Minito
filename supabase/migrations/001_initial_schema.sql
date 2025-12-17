-- System Prompts Table
-- Stores active system prompts for the AI task breaking service
CREATE TABLE IF NOT EXISTS system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index to ensure only one active prompt at a time
CREATE UNIQUE INDEX IF NOT EXISTS system_prompts_active_unique 
ON system_prompts (is_active) 
WHERE is_active = true;

-- Tasks Table
-- Stores task processing metadata (privacy-first: no raw input, only hash)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_hash TEXT NOT NULL, -- HMAC_SHA256 hash of sanitized input
  guest_id TEXT, -- Guest identity UUID from client
  request_id TEXT, -- x-request-id from client tracing
  token_usage INTEGER, -- OpenAI token usage count
  latency_ms INTEGER, -- Request processing time in milliseconds
  fallback_reason TEXT, -- FallbackReason enum value if fallback was used
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by input hash (for potential deduplication)
CREATE INDEX IF NOT EXISTS tasks_input_hash_idx ON tasks (input_hash);

-- Index for guest_id queries (for analytics)
CREATE INDEX IF NOT EXISTS tasks_guest_id_idx ON tasks (guest_id);

-- Index for created_at (for data retention cleanup)
CREATE INDEX IF NOT EXISTS tasks_created_at_idx ON tasks (created_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on system_prompts
CREATE TRIGGER update_system_prompts_updated_at
BEFORE UPDATE ON system_prompts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function for data retention: delete tasks older than 90 days
CREATE OR REPLACE FUNCTION cleanup_old_tasks()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM tasks
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job (requires pg_cron extension)
-- Uncomment if you have pg_cron enabled in your Supabase project
-- SELECT cron.schedule('cleanup-old-tasks', '0 2 * * *', 'SELECT cleanup_old_tasks();');















