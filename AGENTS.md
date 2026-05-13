# AGENTS.md

Guidance for any AI coding agent (Claude Code, Cursor, Codex, Aider, etc.) working in this repo. Human-facing context lives in `CLAUDE.md`; this file is the operational contract.

## Project state

**All 5 phases of the spec PDF are shipped.** 13 workflows, 3 migrations, 5 cron schedules. The repo is in operate-and-extend mode, not build-from-scratch mode. Before adding anything new, check the phase status table in `CLAUDE.md` and the "Definition of done" table below — the bar for "done" is now higher than for "first version."

## Repository purpose

Self-healing RAG pipeline. Main workflow serves answers; multiple watcher + agent workflows audit, repair, diagnose, and A/B test the system. All components communicate through one Postgres database — no internal HTTP APIs between halves.

## Ground rules

1. **Read `Self_Healing_RAG_Pipeline_Project.pdf` and `CLAUDE.md` before making architectural changes.** The phase order in the PDF is intentional. Don't build Phase 4 before Phase 1 works.
2. **Boring before smart.** Default to the simplest implementation that satisfies the current phase's goal. Reranking, hybrid search, and streaming are deferred until a phase explicitly calls for them.
3. **Postgres is the integration point.** If you find yourself adding an HTTP call between the main workflow and a watcher, stop — write to a table instead.
4. **Logging is not optional.** Every user query, every retrieved chunk set, every LLM call gets a row. Phases 1–5 are impossible without this trail.

## Code & workflow conventions

### n8n workflows
- Live in `workflows/*.json`, exported from the n8n UI.
- One workflow per file. Filename matches the workflow name with `-` separators (e.g. `main-chat.json`, `watcher-eval-cron.json`).
- Re-export after every meaningful UI change and commit the diff. Don't hand-edit the JSON unless fixing a credential reference.
- Credentials are referenced by name (`Anthropic API`, `OpenAI API`, `Postgres rag`) — never inline values.

### Python (Phase 4+)
- FastAPI app in `agent/` directory.
- `uv` for dependency management. `pyproject.toml`, no `requirements.txt`.
- Type hints on all public functions. `ruff` + `pyright` clean before commit.
- Investigator agent uses OpenAI Agents SDK; tool functions are pure (input → DB read → structured output), no side effects.

### SQL
- Migrations in `db/migrations/NNNN_description.sql`, applied in order.
- Schemas: `rag` for chunk/embedding storage, `obs` for observability (queries, eval_runs, drift_scores, baseline_embeddings).
- `embedding_model` column on every embedding-bearing table from day one.

### Comments
- Default to no comments. Only write one when the *why* is non-obvious — a threshold value backed by an experiment, a workaround for a known n8n bug, an invariant a future reader would otherwise break.
- Never narrate what the code does. Never reference the current task or PR.

## Data model invariants

These hold across all phases. Breaking them silently is the most expensive kind of bug here.

- A chunk's `embedding` and `embedding_model` are written together or not at all.
- Every row in `obs.queries` has a `model_version` (chat model + embedding model + retrieval strategy). Phase 5 canary depends on it.
- `obs.eval_runs.query_id` is a foreign key into `obs.queries`. Don't denormalize the query text into eval_runs.
- `baseline_embeddings` is append-only. Drift is measured against frozen history, not against current state.

## What requires user confirmation

- Schema migrations that drop columns or tables.
- Re-embedding the entire corpus (cost + time). Phase 4 incremental re-embed of <1000 chunks is fine.
- Switching embedding or chat models outside the canary system.
- Pushing to GitHub, opening PRs, or any action visible to others.
- Adding a new external service (Pinecone, Redis, etc.) — the answer is almost always no.

## Definition of done per phase

| Phase | Done means |
|---|---|
| 0 | `curl` to n8n webhook returns a grounded answer; `obs.queries` has the row. |
| 1 | Eval cron has run for ≥3 days; dashboard query shows score-over-time; one Slack alert has fired (intentionally or otherwise). |
| 2 | Editing a tracked doc updates affected chunks' vectors and `updated_at` within 5 minutes (polling cron) or 60 seconds (webhook variant), verified manually across INSERT / CHANGED-cosmetic / CHANGED-meaningful / DELETE. |
| 3 | `drift_scores` table receives one cosine-to-baseline row per chunk per weekly run (observe-only v1). Trend over ≥4 weeks visible. Auto-fix and re-baseline command deferred. |
| 4 | A real eval failure produced a structured diagnosis written to `obs.agent_diagnoses` (root_cause + recommended_fix + diagnosis), without human prompting. v1 is prompt-only — tool sub-workflows exist in repo but aren't yet wired to the agent. |
| 5 | Two `model_version` variants have run side-by-side; eval-score delta visible via `db/queries/canary_compare.sql`. Promotion is a manual decision (v1) made by reading the comparison. |

## Anti-patterns to refuse

- Building the investigator agent before the eval loop exists. It has nothing to investigate.
- "Temporary" hardcoded API keys in workflow JSON or Python files.
- Wrapping the Anthropic/OpenAI SDKs in a custom client class. Use them directly.
- Re-embedding the whole corpus to "be safe." Always incremental, always scoped to drifted/changed chunks.
- Adding feature flags or backwards-compat shims. This is a greenfield project; change the code.
- **Manipulating production DB rows to test workflow branches.** Use a Neon branch instead — `mcp__neon__create_branch` is one tool call. Phase 2 was built with planted lies on `main` and it cost us debugging cycles when a chunk's embedding was left in an inconsistent state mid-test. Branches isolate destructive tests for free.
