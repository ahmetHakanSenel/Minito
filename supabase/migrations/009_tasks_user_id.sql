-- Rate limiting and analytics are keyed by the authenticated user instead of a
-- client-generated guest id, which any caller could rotate to dodge the limit.
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS tasks_user_created_idx ON tasks (user_id, created_at);
