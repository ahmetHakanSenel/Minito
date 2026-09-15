-- User-owned history of AI task breakdowns, synced across devices.
CREATE TABLE IF NOT EXISTS task_breakdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 1000),
  empathy_bridge TEXT,
  first_step_hook TEXT,
  steps JSONB NOT NULL CHECK (jsonb_typeof(steps) = 'array'),
  completed_step_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_step_count >= 0),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS task_breakdowns_user_created_idx
ON task_breakdowns (user_id, created_at DESC);

CREATE TRIGGER update_task_breakdowns_updated_at
BEFORE UPDATE ON task_breakdowns
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE task_breakdowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own breakdowns"
ON task_breakdowns FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own breakdowns"
ON task_breakdowns FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own breakdowns"
ON task_breakdowns FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own breakdowns"
ON task_breakdowns FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);
