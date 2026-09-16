-- Schema hardening and data minimisation, after the move to atomic quotas (014).
--
-- DEPLOY ORDER (expand → deploy → contract): apply 014, deploy the break-task version that calls
-- check_and_consume_quota, then apply this file. This file drops columns the previous function
-- version still writes; applied too early, that version's telemetry inserts would fail.

-- ─── Telemetry rows: one per request, idempotent to retry ───────────────────────────────────────

-- request_id used to be the client's tracing id, so two rows could share one and a single
-- feedback call could score both. The server issues it now. Older duplicates keep only their
-- newest row linked; the rest lose the link, not the row.
UPDATE public.tasks AS t
SET request_id = NULL
WHERE t.request_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.tasks AS newer
    WHERE newer.request_id = t.request_id
      AND (newer.created_at, newer.id) > (t.created_at, t.id)
  );

DROP INDEX IF EXISTS public.tasks_request_id_idx;

-- Unique, so a telemetry insert retried after a lost acknowledgement cannot write a second row.
CREATE UNIQUE INDEX IF NOT EXISTS tasks_request_id_key ON public.tasks (request_id);

-- ─── Data minimisation ──────────────────────────────────────────────────────────────────────────

-- Rate limiting no longer reads `tasks` (014), so the hashed client IP has no purpose left, and
-- data without a purpose is not kept. guest_id predates required sign-in.
DROP INDEX IF EXISTS public.tasks_ip_created_idx;

DROP INDEX IF EXISTS public.tasks_guest_id_idx;

ALTER TABLE public.tasks
DROP COLUMN IF EXISTS client_ip_hash,
DROP COLUMN IF EXISTS guest_id;

-- Nothing queries inside `steps`, and a GIN index taxes every insert on the hot path.
DROP INDEX IF EXISTS public.tasks_steps_idx;

-- The prompt is versioned in code (PROMPT_VERSION); this table has not been read since.
DROP TABLE IF EXISTS public.system_prompts;

-- Unused by the app, and upsert_translation was a write path into public copy.
DROP FUNCTION IF EXISTS public.get_translations_for_language(TEXT, TEXT);

DROP FUNCTION IF EXISTS public.upsert_translation(TEXT, TEXT, TEXT, TEXT);

-- ─── Functions: fixed search_path, least privilege ──────────────────────────────────────────────
-- A function without a fixed search_path resolves names through whatever path its caller set.
-- Every function below pins an empty path and schema-qualifies what it touches.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_breakdown_feedback(p_request_id TEXT, p_score TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF p_score IS NULL OR p_score NOT IN ('helpful', 'too_large', 'too_small', 'wrong_tone') THEN
    RAISE EXCEPTION 'invalid feedback score: %', p_score USING ERRCODE = '22023';
  END IF;

  IF p_request_id IS NULL OR p_request_id = '' THEN
    RETURN FALSE;
  END IF;

  -- The caller's own row only. `tasks` stays closed to clients; this is the one write they get.
  UPDATE public.tasks
  SET feedback_score = p_score,
      feedback_at = NOW()
  WHERE request_id = p_request_id
    AND user_id = (SELECT auth.uid());

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Supabase grants EXECUTE on new public functions to anon and authenticated explicitly, so
-- revoking from PUBLIC alone leaves anon able to call it.
REVOKE ALL ON FUNCTION public.submit_breakdown_feedback(TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.submit_breakdown_feedback(TEXT, TEXT) TO authenticated;

-- Retention: request telemetry is kept for 90 days.
CREATE OR REPLACE FUNCTION public.cleanup_old_tasks()
RETURNS INTEGER
LANGUAGE sql
SET search_path = ''
AS $$
  WITH deleted AS (
    DELETE FROM public.tasks
    WHERE created_at < NOW() - INTERVAL '90 days'
    RETURNING 1
  )
  SELECT count(*)::INTEGER FROM deleted;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_tasks() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cleanup_old_tasks() TO service_role;

-- With pg_cron enabled:
-- SELECT cron.schedule('cleanup-old-tasks', '0 3 * * *', 'SELECT public.cleanup_old_tasks();');
