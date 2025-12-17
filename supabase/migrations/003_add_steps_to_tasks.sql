-- Add steps column to tasks table to store AI-generated task breakdown steps
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS steps JSONB;

-- Add index for querying by steps (useful for analytics)
CREATE INDEX IF NOT EXISTS tasks_steps_idx ON tasks USING GIN (steps);

-- Add comment
COMMENT ON COLUMN tasks.steps IS 'JSON array of task breakdown steps returned by AI';












