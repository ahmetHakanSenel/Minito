-- Day-2 AI operations: per-request quality telemetry, and a closed feedback loop.
--
-- `latency_ms` and `token_usage` already exist (001/003). `latency_ms` stays end-to-end, so the
-- model's own share gets its own column: the gap between them is our infrastructure overhead.
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS ai_model TEXT,
ADD COLUMN IF NOT EXISTS prompt_version TEXT,
ADD COLUMN IF NOT EXISTS ai_latency_ms INTEGER CHECK (ai_latency_ms >= 0),
ADD COLUMN IF NOT EXISTS breakdown_source TEXT CHECK (
  breakdown_source IN ('model', 'repaired', 'fallback')
),
ADD COLUMN IF NOT EXISTS feedback_score TEXT CHECK (
  feedback_score IN ('helpful', 'too_large', 'too_small', 'wrong_tone')
),
ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ;

-- Feedback arrives by request id; quality is read per prompt version.
CREATE INDEX IF NOT EXISTS tasks_request_id_idx ON tasks (request_id);

CREATE INDEX IF NOT EXISTS tasks_prompt_version_created_idx
ON tasks (prompt_version, created_at DESC);

-- `tasks` stays unreadable and unwritable by clients (007). Feedback therefore goes through this
-- one function, which can only write a valid score, only on a row the caller owns, and reveals
-- nothing else about the row.
-- p_request_id is TEXT because `tasks.request_id` is the client's tracing id, stored as text.
CREATE OR REPLACE FUNCTION submit_breakdown_feedback(p_request_id TEXT, p_score TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF p_score IS NULL OR p_score NOT IN ('helpful', 'too_large', 'too_small', 'wrong_tone') THEN
    RAISE EXCEPTION 'invalid feedback score: %', p_score;
  END IF;

  IF p_request_id IS NULL OR p_request_id = '' THEN
    RETURN FALSE;
  END IF;

  UPDATE tasks
  SET feedback_score = p_score,
      feedback_at = NOW()
  WHERE request_id = p_request_id
    AND user_id = (SELECT auth.uid());

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION submit_breakdown_feedback(TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION submit_breakdown_feedback(TEXT, TEXT) TO authenticated;
