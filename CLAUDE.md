# Self-Healing RAG Pipeline

Project spec: `Self_Healing_RAG_Pipeline_Project.pdf` in this directory. Read it before making architectural decisions.

## What this project is

A RAG system that monitors its own answer quality, detects embedding/content drift, and re-embeds itself without manual intervention. The build is split into two cooperating halves that talk through Postgres — there is no service-to-service API.

```
Main workflow         Watcher workflows (3 triggers)
─────────────         ──────────────────────────────
ingest → embed        cron 6h     → eval loop (LLM-as-judge)
retrieve → answer     doc webhook → diff + re-embed
log everything        cron weekly → drift detection
       │                          │
       └────────► Postgres ◄──────┘
                  (chunks, embeddings,
                   queries, eval_runs)
```

Watchers never serve users. They read logs and embeddings, judge quality, and write fixes back to the same tables the main RAG reads from. Postgres is the integration point.

## Stack decisions

| Concern | Choice | Why |
|---|---|---|
| Vector store | Postgres + pgvector | One database for app + vectors + logs. No new infra. |
| Workflow engine | n8n (self-hosted) | Cron, webhooks, HTTP, Postgres, Anthropic — all native nodes. |
| LLM (chat + judge) | Claude via Anthropic API | Judge prompts need long-context reasoning. |
| Embeddings | OpenAI `text-embedding-3-small` | Cheap, good enough for v1. Swap later via canary. |
| API layer | **None until Phase 4** | n8n webhook serves `/chat` directly. FastAPI joins when the agent does. |
| Frontend | Next.js test page (Phase 0+) | Just enough to drive queries conversationally. |

### Why no FastAPI in Phase 0

n8n can host the `/chat` endpoint via a Webhook node, run pgvector queries via the Postgres node, and call Claude via the Anthropic node. Adding FastAPI before there is custom retrieval logic, streaming, or Python-only code (the investigator agent) is premature. Reintroduce it in Phase 4 when the OpenAI Agents SDK shows up — that code has to live in Python anyway.

## Phase status

- [ ] **Phase 0 (W1)** — boring RAG: ingest one source, pgvector, n8n webhook `/chat`, query log
- [ ] **Phase 1 (W2)** — eval loop: cron → sample queries → LLM-as-judge → `eval_runs` table → Slack alert
- [ ] **Phase 2 (W3)** — doc-change webhook: diff old/new, re-embed if cosine < 0.95
- [ ] **Phase 3 (W4)** — drift detection: weekly re-embed sample, compare to baseline
- [ ] **Phase 4 (W5–6)** — investigator agent (OpenAI Agents SDK in FastAPI)
- [ ] **Phase 5 (W7+)** — canary deploys + thumbs-up/down feedback into eval set

The doc says stop after Phase 2 and ship. Treat that as the real MVP target.

## Conventions

- **n8n workflows live in `workflows/` as exported JSON** and are committed to git. Re-export after every meaningful change.
- **One Postgres database, schemas separated by concern**: `rag` (chunks, embeddings), `obs` (queries, eval_runs, drift_scores).
- **Every user query writes a row to `obs.queries` before retrieval.** Phase 1 cannot exist without this. Don't skip the logging table in Phase 0.
- **Embeddings are versioned**: `chunks.embedding_model` column from day one. Phase 5 canary depends on it.
- **Cosine similarity threshold for "meaningful change" is 0.95.** Tune later with real data, not before.
- **Secrets in `.env`, never in workflow JSON.** n8n credentials are referenced by name, not value.

## What not to build

- No Pinecone/Weaviate/Qdrant. pgvector is enough until it isn't, and it won't be for a long time.
- No reranker, hybrid search, or query rewriting in Phase 0. Top-k cosine on `text-embedding-3-small` is the baseline you must beat later.
- No streaming responses until a UI actually needs them.
- No abstractions over the Anthropic/OpenAI SDKs. Call them directly.
- No "future-proofing" for swapping LLM providers. The canary system in Phase 5 is the swap mechanism.

## Working agreements with the user

- User's GitHub handle: `jawwad-ali`. Per-repo git identity, not global.
- Ship continuously: commit → push → PR without asking, unless the action is risky (force-push, identity mismatch).
- Audit comment style and `function` vs arrow before pushing to any external repo. This project is the user's own — its style is set here.
- Verify file/function existence before recommending from memory. Memory is a hint, not ground truth.
