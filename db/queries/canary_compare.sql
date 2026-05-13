-- Phase 5 — Canary comparison
-- Run weekly (or whenever you want to evaluate a canary).
-- Compares all model_version variants seen in the last N days
-- across eval scores + user feedback + latency.
--
-- Usage:
--   In Neon SQL Editor:
--     SET LOCAL search_path = obs, public;
--   Or run as-is.

SELECT
    q.model_version,
    count(DISTINCT q.id)                                          AS queries_served,
    count(e.id)                                                   AS n_evals,
    round(avg(e.overall),       2)                                AS avg_overall,
    round(avg(e.relevance),     2)                                AS avg_relevance,
    round(avg(e.accuracy),      2)                                AS avg_accuracy,
    round(avg(e.completeness),  2)                                AS avg_completeness,
    round(avg(q.latency_ms)::numeric, 0)                          AS avg_latency_ms,
    count(*) FILTER (WHERE q.user_feedback =  1)                  AS thumbs_up,
    count(*) FILTER (WHERE q.user_feedback = -1)                  AS thumbs_down,
    round(
      100.0 * count(*) FILTER (WHERE q.user_feedback = 1)::numeric
            / NULLIF(count(*) FILTER (WHERE q.user_feedback IS NOT NULL), 0),
      1
    )                                                             AS pct_positive
FROM obs.queries q
LEFT JOIN obs.eval_runs e ON e.query_id = q.id
WHERE q.created_at >= now() - interval '7 days'
GROUP BY q.model_version
ORDER BY avg_overall DESC NULLS LAST;

-- Decision rule (manual, for v1):
--   Promote a canary if avg_overall is higher AND queries_served >= 20
--   AND the regression on any individual dimension is < 0.2.
--   Otherwise keep current control.
