# Self-Healing RAG Dashboard (UI)

Server-rendered Next.js 15 dashboard that reads directly from the same Neon Postgres that the n8n workflows write to.

## Setup

1. Install deps:
   ```bash
   npm install
   ```
2. Configure environment:
   ```bash
   cp .env.local.example .env.local
   ```
   Fill in `DATABASE_URL` with your Neon **pooled** connection string (same one n8n uses).
3. Run dev server:
   ```bash
   npm run dev
   ```
   Open <http://localhost:3000>.

## What it shows (v1)

| Panel | Source |
|---|---|
| 6 headline metrics | aggregate query over `obs.queries` + `obs.eval_runs` + `obs.agent_diagnoses` + `obs.drift_scores` |
| Recent queries (10) | `obs.queries` LEFT JOIN `obs.eval_runs` |
| Agent diagnoses (5) | `obs.agent_diagnoses` JOIN `obs.queries` |

## Architecture

- **Next.js 15 App Router** — single page (`src/app/page.tsx`) as a Server Component
- **`@neondatabase/serverless`** — direct DB access, no API routes needed for v1
- **No client-side state** — page re-renders fully on each request (`dynamic = "force-dynamic"`)
- **Tailwind CSS** — no component library yet

## Next steps (not built yet)

- `/queries/[id]` route to show one query with its full retrieved chunks + eval + diagnosis
- `/canary` page rendering `db/queries/canary_compare.sql`
- Thumbs-up / thumbs-down buttons that POST to `/webhook/feedback`
- Live updates via polling or Postgres `LISTEN/NOTIFY`
- Auth (currently anyone with the URL can see internal data)
