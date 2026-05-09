-- Phase 0 schema. Two schemas, separated by concern.
--   rag.*  - corpus storage and embeddings
--   obs.*  - observability: queries, judge scores, drift

CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS rag;
CREATE SCHEMA IF NOT EXISTS obs;

CREATE TABLE rag.documents (
    id           BIGSERIAL PRIMARY KEY,
    source       TEXT NOT NULL,
    title        TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rag.chunks (
    id              BIGSERIAL PRIMARY KEY,
    document_id     BIGINT NOT NULL REFERENCES rag.documents(id) ON DELETE CASCADE,
    chunk_index     INT NOT NULL,
    content         TEXT NOT NULL,
    content_hash    TEXT NOT NULL,
    token_count     INT,
    embedding       vector(1536),
    embedding_model TEXT NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX chunks_embedding_ivfflat
    ON rag.chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE obs.queries (
    id                BIGSERIAL PRIMARY KEY,
    question          TEXT NOT NULL,
    answer            TEXT,
    retrieved_chunks  JSONB NOT NULL DEFAULT '[]'::jsonb,
    chat_model        TEXT NOT NULL,
    embedding_model   TEXT NOT NULL,
    retrieval_k       INT NOT NULL,
    model_version     TEXT NOT NULL,
    latency_ms        INT,
    user_feedback     SMALLINT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX queries_created_at ON obs.queries (created_at DESC);

CREATE TABLE obs.eval_runs (
    id              BIGSERIAL PRIMARY KEY,
    query_id        BIGINT NOT NULL REFERENCES obs.queries(id) ON DELETE CASCADE,
    judge_model     TEXT NOT NULL,
    relevance       SMALLINT NOT NULL,
    accuracy        SMALLINT NOT NULL,
    completeness    SMALLINT NOT NULL,
    overall         NUMERIC(3,2) GENERATED ALWAYS AS
                    ((relevance + accuracy + completeness)::numeric / 3) STORED,
    rationale       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX eval_runs_created_at ON obs.eval_runs (created_at DESC);

CREATE TABLE obs.baseline_embeddings (
    id              BIGSERIAL PRIMARY KEY,
    chunk_id        BIGINT NOT NULL REFERENCES rag.chunks(id) ON DELETE CASCADE,
    embedding       vector(1536) NOT NULL,
    embedding_model TEXT NOT NULL,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE obs.drift_scores (
    id              BIGSERIAL PRIMARY KEY,
    chunk_id        BIGINT NOT NULL REFERENCES rag.chunks(id) ON DELETE CASCADE,
    cosine_to_base  NUMERIC(6,5) NOT NULL,
    baseline_id     BIGINT NOT NULL REFERENCES obs.baseline_embeddings(id),
    measured_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX drift_measured_at ON obs.drift_scores (measured_at DESC);
