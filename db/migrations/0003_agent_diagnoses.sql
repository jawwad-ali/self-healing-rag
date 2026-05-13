-- Phase 4 observability table: investigator agent diagnoses
-- One row per failed-query investigation. The agent writes its findings here;
-- a "morning report" SQL query reads from it.

CREATE TABLE IF NOT EXISTS obs.agent_diagnoses (
    id                BIGSERIAL PRIMARY KEY,
    query_id          BIGINT NOT NULL REFERENCES obs.queries(id) ON DELETE CASCADE,
    eval_run_id       BIGINT REFERENCES obs.eval_runs(id) ON DELETE SET NULL,
    diagnosis         TEXT NOT NULL,
    root_cause        TEXT,
    recommended_fix   TEXT,
    tools_used        JSONB NOT NULL DEFAULT '[]'::jsonb,
    agent_model       TEXT NOT NULL,
    iterations        INT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_diagnoses_created_at
    ON obs.agent_diagnoses (created_at DESC);
