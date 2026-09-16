-- The stopping point is the plan's explicit permission to stop, written for that specific
-- breakdown. Without a column of its own it was lost as soon as the task was reopened from
-- history. Nullable, because breakdowns saved before the structured output contract have none.
ALTER TABLE task_breakdowns
ADD COLUMN IF NOT EXISTS stopping_point TEXT CHECK (char_length(stopping_point) <= 1000);
