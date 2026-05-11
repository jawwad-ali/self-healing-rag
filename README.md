# Self-Healing RAG Pipeline

A RAG system that watches its own quality, notices when it's getting worse, and fixes itself — without anyone telling it to.

Built on **n8n + Neon Postgres + OpenAI**. No Python runtime required.

---

## What this project is, in one minute

**RAG** (Retrieval-Augmented Generation) is when an AI looks things up in your documents *before* answering. Like an open-book exam — the AI reads your knowledge base, then writes the answer.

The problem: **RAG quietly gets worse over time.** Documents change, prices update, policies are revised, the model that turns text into searchable "fingerprints" (embeddings) drifts. Most teams only find out when a customer complains.

This project is a RAG that monitors itself. Three small background workflows (we call them *watchers*) run on a schedule, grade the system's own answers, detect when documents have changed, and re-do the parts that have gone stale. It's the difference between buying a car and buying a car that books its own service appointments.

---

## How it works

```
┌──────────────────────┐         ┌─────────────────────────────────┐
│   MAIN WORKFLOW      │         │   WATCHER WORKFLOWS             │
│   (serves users)     │         │   (audit & repair)              │
│                      │         │                                 │
│  question  ────►     │         │   every 6h:                     │
│  retrieve top-k      │         │   ├─ pull random user queries   │
│  ask the LLM         │         │   ├─ have a 2nd LLM grade them  │
│  return answer       │         │   └─ alert if scores drop       │
│  log everything      │         │                                 │
│                      │         │   on document edit:             │
└──────────┬───────────┘         │   ├─ diff old vs new            │
           │                     │   └─ re-embed if meaningful     │
           ▼                     │                                 │
┌──────────────────────────────┐ │   weekly:                       │
│        POSTGRES              │◄┤   ├─ re-embed sample chunks     │
│  (chunks, embeddings,        │ │   └─ flag drifted ones to fix   │
│   query log, eval scores)    │ │                                 │
└──────────────────────────────┘ └─────────────────────────────────┘
```

The two halves never talk to each other directly. They share one Postgres database. That's it. Postgres is the API.

---

## The three watchers

| Watcher | When it runs | What it asks |
|---|---|---|
| **Quality eval** | Every 6 hours | "Are recent answers still good?" |
| **Doc-change detector** | When a document is edited | "Did this edit actually change the meaning?" |
| **Drift detector** | Once a week | "Are the embeddings still meaningful, even if nothing was edited?" |

Each watcher writes its findings to Postgres. The main workflow reads what it needs. No HTTP calls between them.

---

## Why this is interesting

Most engineers can build a basic RAG in an afternoon. Almost nobody builds the **eval, drift detection, and feedback loops** that keep one healthy after week six. This project is about that second part — applying ML-ops thinking to AI systems.

It's the kind of work AI infrastructure teams actually need but rarely advertise.

---

## Stack

| Concern | Choice | Why |
|---|---|---|
| Vector store | **Postgres + pgvector** (Neon) | One database for everything. No new infra. |
| Workflow engine | **n8n** | Cron, webhooks, HTTP, Postgres, AI nodes — all native. |
| Chat LLM | **OpenAI** (`gpt-4o-mini`) | Cheap, fast, good enough for v1. |
| Embeddings | **OpenAI** (`text-embedding-3-small`) | Cheap, swap later via canary deployments. |
| Judge LLM | **Anthropic Claude** | Different model than chat — so it isn't grading itself. |
| Investigator agent | **n8n AI Agent node** | Runs entirely inside n8n. No Python runtime needed. |

---

## Roadmap

This is built in phases. Each phase is independently useful — you don't need all five to ship something real.

| Phase | What ships | Status |
|---|---|---|
| **0** | A working RAG: ingest, embed, retrieve, answer, log every query | ✅ shipped |
| **1** | Quality eval loop: a 2nd LLM grades answers; alerts on regression | ✅ shipped |
| **2** | Doc-change detection: edits trigger re-embedding only if meaningful | not started |
| **3** | Drift detection: weekly comparison of embeddings vs. baseline | not started |
| **4** | Investigator agent: when scores drop, an agent diagnoses *why* | not started |
| **5** | Canary deployments + user-feedback loop: system improves itself weekly | not started |

The honest version: **Phases 0 to 2 alone** are already what most "RAG developers" can't actually build. That's the realistic shipping target.

---

## Repository layout

```
self-healing-rag/
├── Self_Healing_RAG_Pipeline_Project.pdf   ← full project specification
├── CLAUDE.md                               ← AI collaboration context
├── AGENTS.md                               ← operational contract for AI agents
├── corpus/
│   ├── cinder-analytics-docs.pdf           ← v1 corpus (fictional SaaS docs)
│   └── source/
│       └── cinder-analytics-docs.md        ← markdown source
├── db/
│   └── migrations/
│       └── 0001_init.sql                   ← Postgres + pgvector schema
├── workflows/                              ← exported n8n workflows (coming)
├── .env.example
└── README.md
```

The corpus is a fictional B2B SaaS product documentation set (Cinder Analytics) — chosen because it has natural sections, version numbers, and pricing that *will* drift over time. Perfect for showing self-healing behavior on a realistic-looking knowledge base.

---

## Run it locally

Coming once Phase 0 lands. The plan:

1. Clone the repo, copy `.env.example` to `.env`, fill in your keys.
2. Apply the migration to your Neon (or local) Postgres.
3. Import the n8n workflows from `workflows/` into a self-hosted n8n.
4. Hit the chat webhook.

Phase 0 currently in progress. Watch this space.

---

## Why this exists

The classic mistake on ambitious AI projects is building the smart part before the boring part actually works. This repo is built the other way around: ingest first, log everything, watch for problems, then add intelligence.

Build it boring. Build it observable. **Then** make it smart.
