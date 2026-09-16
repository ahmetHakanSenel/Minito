-- Second telemetry layer: the fields that explain *why* a breakdown turned out the way it did.
--
-- 012 answered "which prompt and model, how fast, how many tokens". These answer the follow-up
-- questions: was the reply truncated, which rule did it break, was it written in the right
-- language, and how much of the prompt was served from the provider's cache.
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS finish_reason TEXT,
ADD COLUMN IF NOT EXISTS prompt_token_usage INTEGER CHECK (prompt_token_usage >= 0),
ADD COLUMN IF NOT EXISTS completion_token_usage INTEGER CHECK (completion_token_usage >= 0),
ADD COLUMN IF NOT EXISTS cached_token_usage INTEGER CHECK (cached_token_usage >= 0),
ADD COLUMN IF NOT EXISTS response_language TEXT,
ADD COLUMN IF NOT EXISTS language_match BOOLEAN,
ADD COLUMN IF NOT EXISTS validation_issues JSONB CHECK (
  validation_issues IS NULL OR jsonb_typeof(validation_issues) = 'array'
);

-- The two quality questions asked most often: how often does the first reply fail validation,
-- and how often does the model stop for the wrong reason.
CREATE INDEX IF NOT EXISTS tasks_quality_idx
ON tasks (prompt_version, breakdown_source, finish_reason);
