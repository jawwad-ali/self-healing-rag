# Self-Healing RAG Pipeline

A RAG system that watches its own quality, notices when it's getting worse, and fixes itself — without anyone telling it to.

Built on **n8n + Neon Postgres + OpenAI**. No Python runtime required.

> **Status: all 5 phases shipped.** 13 workflows live, 3 schema migrations, 5 cron schedules running concurrently. The full closed loop is proven end-to-end with real data — see the [canary results](#whats-actually-running-right-now) below.

---

## What this project is, in one minute

**RAG** (Retrieval-Augmented Generation) is when an AI looks things up in your documents *before* answering. Like an open-book exam — the AI reads your knowledge base, then writes the answer.

The problem: **RAG quietly gets worse over time.** Documents change, prices update, policies are revised, the model that turns text into searchable "fingerprints" (embeddings) drifts. Most teams only find out when a customer complains.

This project is a RAG that monitors itself. Six background workflows (we call them *watchers*) run on a schedule, grade the system's own answers, detect when documents have changed, re-do the parts that have gone stale, **and now also A/B-test their own fixes**. It's the difference between buying a car and buying a car that books its own service appointments, then runs a controlled experiment to verify each service actually helped.

## What's actually running right now

After all 5 phases shipped, the system is live with this evidence trail in the database:

| Demo step | What happened (real data) |
|---|---|
| Phase 1 graded the chat answers | Flagged *"What is new in Cinder v3.0?"* at overall score 3.00/5 |
| Phase 4 agent diagnosed it | **"Increase k to 8 to retrieve more changelog chunks"** |
| Phase 5 canary A/B tested the fix | 8 queries × control (k=5) + 8 × canary (k=8), graded by gpt-4o |
| Eval delta | control overall 4.65 → canary **4.88 (+0.23)**, completeness **+0.36** ✓ |
| Decision | promote v0.2 (operator accepts +3.3s latency for measurable quality gain) |

That's **eval → diagnose → A/B test → data-backed promotion**, end-to-end, without anyone in the loop except the operator clicking "promote" at the end.

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
| **2** | Doc-change detection: edits trigger re-embedding only if meaningful | ✅ shipped |
| **3** | Drift detection: weekly comparison of embeddings vs. baseline | ✅ shipped |
| **4** | Investigator agent: when scores drop, an agent diagnoses *why* | ✅ shipped |
| **5** | Canary deployments + user-feedback loop: system improves itself weekly | ✅ shipped |

The honest version: **Phases 0 to 2 alone** are already what most "RAG developers" can't actually build. **All five phases shipped here** — including a demonstrated end-to-end self-healing loop where Phase 4's agent diagnosed *"Increase k to 8"* on a failing query, Phase 5's canary tested it 50/50, and the data confirmed +0.36 completeness improvement.

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

The repo carries no secrets and no installed n8n state. Reproduce the system on a fresh machine like this.

### Prerequisites

- **Node 20+** (for the migration runner)
- **n8n 1.119+** — `npm install -g n8n`, or run via Docker
- A **Neon Postgres project** (free tier works; pgvector is available out of the box)
- An **OpenAI API key** (powers both chat and the eval judge)

### 1. Clone and install

```bash
git clone https://github.com/jawwad-ali/self-healing-rag
cd self-healing-rag
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in:
- `DATABASE_URL` — your Neon **pooled** connection string (Neon dashboard → Connection details → "Pooled connection"). Pooled is important; n8n opens a new connection per execution.
- `OPENAI_API_KEY` — `sk-...`

`.env` is gitignored. Never commit it.

### 3. Apply the schema

```bash
npm run migrate
```

Creates `rag.documents`, `rag.chunks`, `obs.queries`, `obs.eval_runs`, plus the `vector` extension. Idempotent — safe to re-run.

### 4. Start n8n

```bash
n8n start
```

First boot asks you to create an owner account. Then open `http://localhost:5678`.

### 5. Add the two credentials in n8n

n8n stores credentials in its own encrypted DB. Go to **Settings → Credentials → New**:

- **OpenAi account** (type: OpenAI API) — paste your `OPENAI_API_KEY`
- **Postgres account** (type: Postgres) — fill host / db / user / password from your Neon dashboard. **SSL mode: require**. Use the **pooled** host (`*-pooler.*`).

These exact names matter — the workflow JSON references them by name.

### 6. Import the workflows

In n8n's top-right menu → **Import from File** — pick each of:

- `workflows/01-ingest-corpus.json` — chunks + embeds the corpus
- `workflows/02-chat-webhook.json` — `/webhook/chat` endpoint
- `workflows/03-eval-loop.json` — every-6-hour judge cron

On first open, each node with a credential dropdown may show "Select credential" — click and pick the matching `OpenAi account` / `Postgres account`.

### 7. Ingest the corpus (one-time)

Open **P0-Ingest-Corpus** and click **Execute Workflow**. Watch for 50 chunks landing — verify:

```sql
SELECT count(*) FROM rag.chunks;  -- 50
```

### 8. Activate the chat + eval workflows

For each of **P0-Chat-Webhook** and **P1-Eval-Loop**: open the workflow, click **Publish** / toggle to **Active** (UI varies by n8n version). The chat webhook will respond at the production URL; the eval cron will fire every 6 hours.

### 9. Smoke test

```bash
curl -X POST http://localhost:5678/webhook/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"What does Cinder charge for the Growth plan?"}'
```

Expected: a grounded answer citing source chunk IDs in ~2 seconds, and a row in `obs.queries`.

---

## Optional: AI-driven development via MCP

If you want Claude Code / Cursor / Codex to manage workflows and run SQL directly:

```bash
# n8n workflow management
claude mcp add n8n-mcp -- npx -y n8n-mcp
# Add WEBHOOK_SECURITY_MODE=moderate to its env if you hit SSRF errors talking to localhost

# Neon Postgres queries + branching
claude mcp add --transport sse neon https://mcp.neon.tech/sse
# First call triggers an OAuth flow in your browser
```

Restart Claude Code after adding. Then the assistant can validate eval scores live, create Postgres branches for canary tests (Phase 5), and build new workflows end-to-end without you clicking around the n8n UI.

### What's intentionally NOT in the repo

- `.env` — your secrets
- `node_modules/`
- `corpus/build/` — transient PDF artifacts (the committed `corpus/cinder-analytics-docs.pdf` is the deliverable)
- Local AI-agent memory (those live per-user in `~/.claude/projects/...` and don't transfer between machines)

---

## Why this exists

The classic mistake on ambitious AI projects is building the smart part before the boring part actually works. This repo is built the other way around: ingest first, log everything, watch for problems, then add intelligence.

Build it boring. Build it observable. **Then** make it smart.
