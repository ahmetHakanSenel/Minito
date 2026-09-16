-- Telemetry playbook: the queries behind docs/RUNBOOK.md.
--
-- Run them as the service role (SQL editor, or psql with the service connection string). Every
-- query is exercised against the real schema by supabase/tests/database.test.mjs, so a
-- migration cannot silently break one.
--
-- SLI definitions used throughout (see the SLO table in the runbook):
--   eligible  = recorded requests, minus CONTENT_FLAGGED (a correct refusal, not a failure)
--   answered  = eligible requests that returned a plan (breakdown_source is set)
--   available = answered / eligible
--   quality   = (model + repaired) / answered: the share of plans that were not the fallback
--   fast      = answered with latency_ms <= 12000 / answered

-- 1. Prompt and model scorecard, last 7 days. The first thing to read after a prompt change.
SELECT
  prompt_version,
  ai_model,
  count(*) AS requests,
  round(avg((breakdown_source = 'model')::int) FILTER (WHERE breakdown_source IS NOT NULL), 3)
    AS first_try_rate,
  round(avg((breakdown_source = 'repaired')::int) FILTER (WHERE breakdown_source IS NOT NULL), 3)
    AS repair_rate,
  round(avg((breakdown_source = 'fallback')::int) FILTER (WHERE breakdown_source IS NOT NULL), 3)
    AS fallback_rate,
  round(avg((fallback_reason = 'AI_DOWN')::int), 3) AS ai_down_rate,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)
    FILTER (WHERE breakdown_source IS NOT NULL) AS p50_latency_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
    FILTER (WHERE breakdown_source IS NOT NULL) AS p95_latency_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY ai_latency_ms)
    FILTER (WHERE breakdown_source IS NOT NULL) AS p95_ai_latency_ms,
  round(avg(token_usage)) AS avg_tokens,
  count(*) FILTER (WHERE finish_reason IN ('length', 'MAX_TOKENS')) AS truncated,
  round(avg((NOT language_match)::int) FILTER (WHERE language_match IS NOT NULL), 3)
    AS language_mismatch_rate,
  count(feedback_score) AS feedback_count,
  round(avg((feedback_score = 'helpful')::int) FILTER (WHERE feedback_score IS NOT NULL), 3)
    AS helpful_rate
FROM public.tasks
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND fallback_reason IS DISTINCT FROM 'CONTENT_FLAGGED'
GROUP BY prompt_version, ai_model
ORDER BY prompt_version DESC NULLS LAST, requests DESC;

-- 2. Hourly SLIs, last 48 hours. A dip in `available` is an outage; a dip in `quality` with
--    `available` intact is a prompt or model regression.
SELECT
  date_trunc('hour', created_at) AS hour,
  count(*) AS eligible,
  round(avg((breakdown_source IS NOT NULL)::int), 4) AS available,
  round(
    avg((breakdown_source IN ('model', 'repaired'))::int) FILTER (WHERE breakdown_source IS NOT NULL),
    4
  ) AS quality,
  round(avg((latency_ms <= 12000)::int) FILTER (WHERE breakdown_source IS NOT NULL), 4) AS fast
FROM public.tasks
WHERE created_at >= NOW() - INTERVAL '48 hours'
  AND fallback_reason IS DISTINCT FROM 'CONTENT_FLAGGED'
GROUP BY 1
ORDER BY 1 DESC;

-- 3. Error budget, rolling 28 days, against the availability SLO of 99%.
--    budget_remaining < 0 means the SLO is already missed for this window.
WITH window_stats AS (
  SELECT
    count(*) AS eligible,
    count(*) FILTER (WHERE breakdown_source IS NULL) AS failed
  FROM public.tasks
  WHERE created_at >= NOW() - INTERVAL '28 days'
    AND fallback_reason IS DISTINCT FROM 'CONTENT_FLAGGED'
)
SELECT
  eligible,
  failed,
  round(1 - failed::numeric / NULLIF(eligible, 0), 4) AS availability,
  floor(eligible * 0.01) AS budget_requests,
  floor(eligible * 0.01) - failed AS budget_remaining
FROM window_stats;

-- 4. Which contract rule breaks most, per prompt version, last 7 days. Fix the prompt for the
--    top line first.
SELECT
  prompt_version,
  regexp_replace(issue, '^steps\.\d+\.', 'steps.N.') AS issue,
  count(*) AS occurrences
FROM public.tasks,
  LATERAL jsonb_array_elements_text(validation_issues) AS issue
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND validation_issues IS NOT NULL
GROUP BY 1, 2
ORDER BY occurrences DESC
LIMIT 20;

-- 5. Estimated spend per day and model, last 30 days. Prices are USD per million tokens;
--    check them against the provider's price list before trusting the number.
WITH prices (ai_model, input_per_mtok, cached_input_per_mtok, output_per_mtok) AS (
  VALUES
    ('gpt-4o-mini', 0.15, 0.075, 0.60),
    ('gemini-2.0-flash', 0.10, 0.025, 0.40)
)
SELECT
  date_trunc('day', t.created_at)::date AS day,
  t.ai_model,
  count(*) AS requests,
  sum(t.token_usage) AS tokens,
  round(
    sum(
      (coalesce(t.prompt_token_usage, 0) - coalesce(t.cached_token_usage, 0)) * p.input_per_mtok
      + coalesce(t.cached_token_usage, 0) * p.cached_input_per_mtok
      + coalesce(t.completion_token_usage, 0) * p.output_per_mtok
    ) / 1000000,
    4
  ) AS estimated_usd
FROM public.tasks AS t
LEFT JOIN prices AS p USING (ai_model)
WHERE t.created_at >= NOW() - INTERVAL '30 days'
  AND t.token_usage IS NOT NULL
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- 6. Quota pressure right now: how many identifiers are at their limit in the current window.
--    A jump in `ip` rows with a flat `user` count points at one address cycling accounts.
SELECT
  split_part(identifier, ':', 1) AS scope,
  count(*) AS active_windows,
  max(request_count) AS highest_count,
  count(*) FILTER (
    WHERE request_count > CASE split_part(identifier, ':', 1) WHEN 'ip' THEN 40 ELSE 20 END
  ) AS at_limit
FROM public.rate_limits
WHERE window_start > NOW() - INTERVAL '1 hour'
GROUP BY 1
ORDER BY 1;

-- 7. Feedback mix per prompt version, last 30 days: what "not helpful" means in practice.
SELECT
  prompt_version,
  feedback_score,
  count(*) AS votes,
  round(count(*)::numeric / sum(count(*)) OVER (PARTITION BY prompt_version), 3) AS share
FROM public.tasks
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND feedback_score IS NOT NULL
GROUP BY 1, 2
ORDER BY 1 DESC, votes DESC;
