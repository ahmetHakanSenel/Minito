-- Atomic rate limiting.
--
-- The quota used to be enforced by counting `tasks` rows, which had two holes:
--   1. The row was written after the AI call finished, so concurrent requests could not see each
--      other in the count and all of them passed.
--   2. `tasks.user_id` cascades on account deletion, so deleting an account reset the IP quota
--      too, which is exactly the account-farming case that quota exists for.
--
-- This table belongs to no user; deleting an account leaves its counters in place.
-- Identifiers carry a scope prefix: 'user:<uuid>', 'ip:<hmac>'. A raw IP is never written.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  identifier TEXT PRIMARY KEY CHECK (char_length(identifier) BETWEEN 1 AND 128),
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count >= 0),
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
-- Every request updates the same row. Free space on the page allows HOT updates, which keeps
-- index bloat down on a table that is almost only ever updated.
WITH (fillfactor = 70);

-- The cleanup job finds expired windows through this index.
CREATE INDEX IF NOT EXISTS rate_limits_window_start_idx ON public.rate_limits (window_start);

-- Clients can neither read nor write this table: RLS on, no policies, no grants.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rate_limits FROM PUBLIC, anon, authenticated;

-- Checks and consumes quota in a single statement.
--
-- INSERT ... ON CONFLICT DO UPDATE locks the conflicting row, so concurrent calls for the same
-- identifier are serialised and each one sees the count the previous one wrote. The window
-- between "count" and "write" that the old approach raced through no longer exists.
--
-- Fixed window: right at a window boundary, up to 2 × p_max_requests can pass in a short burst.
-- For a budget guard that is an acceptable trade for one row and one statement per identifier.
CREATE OR REPLACE FUNCTION public.check_and_consume_quota(
  p_identifier TEXT,
  p_max_requests INTEGER,
  p_window_interval INTERVAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
-- An empty search_path rules out object hijacking through the caller's path, so every object is
-- schema-qualified. pg_catalog functions such as NOW() are always resolved.
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_identifier IS NULL OR char_length(p_identifier) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'invalid identifier' USING ERRCODE = '22023';
  END IF;

  -- The upper bound keeps p_max_requests + 1 below from overflowing.
  IF p_max_requests IS NULL OR p_max_requests NOT BETWEEN 1 AND 1000000 THEN
    RAISE EXCEPTION 'invalid request limit: %', p_max_requests USING ERRCODE = '22023';
  END IF;

  IF p_window_interval IS NULL OR p_window_interval <= INTERVAL '0' THEN
    RAISE EXCEPTION 'invalid window: %', p_window_interval USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.rate_limits AS rl (identifier, request_count, window_start)
  VALUES (p_identifier, 1, NOW())
  ON CONFLICT (identifier) DO UPDATE
  SET
    -- An expired window restarts at 1. Otherwise the count grows, but stops one past the limit:
    -- rejected requests cannot grow it forever, and a lowered limit takes effect on its own.
    request_count = CASE
      WHEN rl.window_start <= NOW() - p_window_interval THEN 1
      ELSE LEAST(rl.request_count + 1, p_max_requests + 1)
    END,
    window_start = CASE
      WHEN rl.window_start <= NOW() - p_window_interval THEN NOW()
      ELSE rl.window_start
    END
  RETURNING rl.request_count INTO v_count;

  RETURN v_count <= p_max_requests;
END;
$$;

-- The caller chooses the identifier, so this function must never be reachable from a client:
-- anyone could spend someone else's quota. Supabase grants EXECUTE on new public functions to
-- anon and authenticated explicitly, so revoking from PUBLIC alone would not be enough.
REVOKE ALL ON FUNCTION public.check_and_consume_quota(TEXT, INTEGER, INTERVAL)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_and_consume_quota(TEXT, INTEGER, INTERVAL) TO service_role;

-- Deletes long-expired windows. p_older_than must not be shorter than the longest window in
-- use, or a live counter is deleted and its quota resets early.
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits(p_older_than INTERVAL DEFAULT INTERVAL '1 day')
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH deleted AS (
    DELETE FROM public.rate_limits
    WHERE window_start < NOW() - p_older_than
    RETURNING 1
  )
  SELECT count(*)::INTEGER FROM deleted;
$$;

REVOKE ALL ON FUNCTION public.cleanup_rate_limits(INTERVAL) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cleanup_rate_limits(INTERVAL) TO service_role;

-- With pg_cron enabled, hourly:
-- SELECT cron.schedule('cleanup-rate-limits', '17 * * * *', 'SELECT public.cleanup_rate_limits();');
