-- Alerting on the SLOs in docs/RUNBOOK.md.
--
-- The ops-alerts function reads one snapshot, evaluates its rules in code, and remembers what is
-- firing here, so it notifies on changes rather than on every run. Nothing here is reachable by
-- clients.

-- Everything the rules need, from one query. Windows follow the runbook: the last hour for
-- symptoms, 28 days for the error budget, today against the previous seven days for spend.
CREATE OR REPLACE FUNCTION public.ops_health_snapshot()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH last_hour AS (
    SELECT
      count(*) AS eligible,
      count(*) FILTER (WHERE breakdown_source IS NOT NULL) AS answered,
      count(*) FILTER (WHERE breakdown_source IN ('model', 'repaired')) AS from_model,
      count(*) FILTER (WHERE breakdown_source IS NOT NULL AND latency_ms <= 12000) AS fast
    FROM public.tasks
    WHERE created_at >= NOW() - INTERVAL '1 hour'
      AND fallback_reason IS DISTINCT FROM 'CONTENT_FLAGGED'
  ),
  budget AS (
    SELECT
      count(*) AS eligible,
      count(*) FILTER (WHERE breakdown_source IS NULL) AS failed
    FROM public.tasks
    WHERE created_at >= NOW() - INTERVAL '28 days'
      AND fallback_reason IS DISTINCT FROM 'CONTENT_FLAGGED'
  ),
  spend AS (
    SELECT
      coalesce(sum(token_usage) FILTER (WHERE created_at >= date_trunc('day', NOW())), 0)
        AS tokens_today,
      coalesce(sum(token_usage) FILTER (WHERE created_at < date_trunc('day', NOW())), 0) / 7.0
        AS tokens_daily_average
    FROM public.tasks
    WHERE created_at >= date_trunc('day', NOW()) - INTERVAL '7 days'
  )
  SELECT jsonb_build_object(
    'generated_at', NOW(),
    'last_hour', jsonb_build_object(
      'eligible', last_hour.eligible,
      'answered', last_hour.answered,
      'from_model', last_hour.from_model,
      'fast', last_hour.fast
    ),
    'budget_28d', jsonb_build_object('eligible', budget.eligible, 'failed', budget.failed),
    'spend', jsonb_build_object(
      'tokens_today', spend.tokens_today,
      'tokens_daily_average', round(spend.tokens_daily_average)
    )
  )
  FROM last_hour, budget, spend;
$$;

REVOKE ALL ON FUNCTION public.ops_health_snapshot() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ops_health_snapshot() TO service_role;

-- One row per rule: whether it is firing, since when, and when a person was last told.
CREATE TABLE IF NOT EXISTS public.ops_alert_state (
  rule TEXT PRIMARY KEY CHECK (rule ~ '^[a-z_]{1,64}$'),
  firing BOOLEAN NOT NULL,
  since TIMESTAMPTZ NOT NULL,
  notified_at TIMESTAMPTZ,
  detail TEXT CHECK (char_length(detail) <= 500)
);

ALTER TABLE public.ops_alert_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ops_alert_state FROM PUBLIC, anon, authenticated;

-- Scheduling needs the project URL and the function's secret, so it is set up per project
-- (docs/RUNBOOK.md#alert-delivery), not in a migration.
