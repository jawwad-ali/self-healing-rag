import Link from "next/link";
import { sql } from "@/lib/db";
import DriftChart, { type DriftPoint } from "./_components/drift-chart";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Stats = {
    queries_24h: number;
    evaluated: number;
    avg_eval: number | null;
    thumbs_up: number;
    thumbs_down: number;
    new_diagnoses: number;
    drift_pct: number | null;
};

type RecentQuery = {
    id: number;
    question: string;
    answer: string;
    model_version: string;
    latency_ms: number;
    overall: string | null;
    created_at: string;
};

type Diagnosis = {
    id: number;
    question: string;
    root_cause: string | null;
    recommended_fix: string | null;
    created_at: string;
};

async function getDashboard() {
    const statsP = sql`
        SELECT
            count(*)::int AS queries_24h,
            count(*) FILTER (WHERE e.overall IS NOT NULL)::int AS evaluated,
            round(avg(e.overall), 2)::float AS avg_eval,
            count(*) FILTER (WHERE q.user_feedback = 1)::int AS thumbs_up,
            count(*) FILTER (WHERE q.user_feedback = -1)::int AS thumbs_down,
            (SELECT count(*)::int FROM obs.agent_diagnoses
             WHERE created_at >= now() - interval '24 hours') AS new_diagnoses,
            (SELECT round(100.0 * count(*) FILTER (WHERE cosine_to_base < 0.95) /
                          NULLIF(count(*), 0), 1)::float
             FROM obs.drift_scores
             WHERE measured_at >= now() - interval '7 days') AS drift_pct
        FROM obs.queries q
        LEFT JOIN obs.eval_runs e ON e.query_id = q.id
        WHERE q.created_at >= now() - interval '24 hours'
    `;
    const queriesP = sql`
        SELECT q.id, q.question, left(q.answer, 240) AS answer, q.model_version,
               q.latency_ms, q.created_at, e.overall
        FROM obs.queries q
        LEFT JOIN obs.eval_runs e ON e.query_id = q.id
        ORDER BY q.created_at DESC
        LIMIT 10
    `;
    const diagnosesP = sql`
        SELECT d.id, q.question, d.root_cause, d.recommended_fix, d.created_at
        FROM obs.agent_diagnoses d
        JOIN obs.queries q ON q.id = d.query_id
        ORDER BY d.created_at DESC
        LIMIT 5
    `;
    const driftP = sql`
        SELECT
            to_char(date_trunc('day', measured_at), 'YYYY-MM-DD') AS date,
            round(avg(cosine_to_base), 5)::float AS avg_cos,
            round(100.0 * count(*) FILTER (WHERE cosine_to_base < 0.95) /
                  NULLIF(count(*), 0), 2)::float AS drifted_pct,
            count(*)::int AS n
        FROM obs.drift_scores
        GROUP BY date_trunc('day', measured_at)
        ORDER BY date_trunc('day', measured_at) ASC
        LIMIT 26
    `;
    const [statsRows, queries, diagnoses, drift] = await Promise.all([
        statsP,
        queriesP,
        diagnosesP,
        driftP,
    ]);
    return {
        stats: statsRows[0] as Stats,
        queries: queries as unknown as RecentQuery[],
        diagnoses: diagnoses as unknown as Diagnosis[],
        driftTrend: drift as unknown as DriftPoint[],
    };
}

function evalTone(avg: number | null): "good" | "warn" | "bad" | "neutral" {
    if (avg == null) return "neutral";
    if (avg >= 4.5) return "good";
    if (avg >= 3.5) return "warn";
    return "bad";
}

function driftTone(pct: number | null): "good" | "warn" | "bad" | "neutral" {
    if (pct == null) return "neutral";
    if (pct < 5) return "good";
    if (pct < 10) return "warn";
    return "bad";
}

const toneClasses: Record<string, string> = {
    good: "text-emerald-700 bg-emerald-50 ring-emerald-200",
    warn: "text-amber-700 bg-amber-50 ring-amber-200",
    bad: "text-rose-700 bg-rose-50 ring-rose-200",
    neutral: "text-slate-700 bg-white ring-slate-200",
};

function Metric({
    label,
    value,
    tone = "neutral",
    sub,
}: {
    label: string;
    value: string | number;
    tone?: "good" | "warn" | "bad" | "neutral";
    sub?: string;
}) {
    return (
        <div
            className={`rounded-xl ring-1 px-4 py-4 ${toneClasses[tone]}`}
        >
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                {label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
            {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
        </div>
    );
}

function formatRelative(iso: string): string {
    const now = Date.now();
    const t = new Date(iso).getTime();
    const sec = Math.floor((now - t) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
}

function scoreTone(score: string | null): string {
    if (score == null) return "text-slate-400";
    const n = Number(score);
    if (n >= 4.5) return "text-emerald-700";
    if (n >= 3.5) return "text-amber-700";
    return "text-rose-700";
}

export default async function Dashboard() {
    const { stats, queries, diagnoses, driftTrend } = await getDashboard();

    return (
        <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight">
                    Self-Healing RAG Dashboard
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                    Live observability for the Cinder Analytics corpus. All times relative
                    to your browser.
                </p>
            </header>

            <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Metric label="Queries (24h)" value={stats.queries_24h ?? 0} />
                <Metric
                    label="Evaluated"
                    value={stats.evaluated ?? 0}
                    sub={`${stats.queries_24h ? Math.round((100 * stats.evaluated) / stats.queries_24h) : 0}% of 24h`}
                />
                <Metric
                    label="Avg eval"
                    value={stats.avg_eval != null ? stats.avg_eval.toFixed(2) : "—"}
                    tone={evalTone(stats.avg_eval)}
                    sub="out of 5"
                />
                <Metric label="Thumbs up" value={stats.thumbs_up ?? 0} tone="good" />
                <Metric
                    label="Thumbs down"
                    value={stats.thumbs_down ?? 0}
                    tone={stats.thumbs_down > 0 ? "warn" : "neutral"}
                />
                <Metric
                    label="Drift %"
                    value={stats.drift_pct != null ? `${stats.drift_pct}%` : "—"}
                    tone={driftTone(stats.drift_pct)}
                    sub="vs May-13 baseline"
                />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent queries */}
                <div className="rounded-xl ring-1 ring-slate-200 bg-white">
                    <div className="px-4 py-3 border-b border-slate-100">
                        <h2 className="text-sm font-semibold">Recent queries</h2>
                        <p className="text-xs text-slate-500">
                            Last 10 calls to /webhook/chat or /webhook/chat-v2
                        </p>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {queries.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-slate-400">
                                No queries yet.
                            </div>
                        ) : (
                            queries.map((q) => (
                                <Link
                                    href={`/queries/${q.id}`}
                                    key={q.id}
                                    className="block px-4 py-3 hover:bg-slate-50 transition"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-medium truncate">
                                                {q.question}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate">
                                                {q.answer}
                                            </div>
                                        </div>
                                        <div
                                            className={`text-xs font-semibold tabular-nums whitespace-nowrap ${scoreTone(q.overall)}`}
                                        >
                                            {q.overall ?? "—"}
                                        </div>
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-400">
                                        <span className="font-mono">{q.model_version}</span>
                                        <span>·</span>
                                        <span>{q.latency_ms}ms</span>
                                        <span>·</span>
                                        <span>{formatRelative(q.created_at)}</span>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>

                {/* Open diagnoses */}
                <div className="rounded-xl ring-1 ring-slate-200 bg-white">
                    <div className="px-4 py-3 border-b border-slate-100">
                        <h2 className="text-sm font-semibold">Agent diagnoses</h2>
                        <p className="text-xs text-slate-500">
                            Last 5 root-cause analyses from the investigator agent
                        </p>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {diagnoses.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-slate-400">
                                No diagnoses yet — failures get analyzed daily at 8am.
                            </div>
                        ) : (
                            diagnoses.map((d) => (
                                <div key={d.id} className="px-4 py-3">
                                    <div className="text-sm font-medium truncate">
                                        {d.question}
                                    </div>
                                    {d.root_cause && (
                                        <div className="mt-1 text-xs text-slate-600 line-clamp-2">
                                            <span className="font-semibold">Cause:</span>{" "}
                                            {d.root_cause}
                                        </div>
                                    )}
                                    {d.recommended_fix && (
                                        <div className="mt-1 text-xs text-emerald-800 line-clamp-2">
                                            <span className="font-semibold">Fix:</span>{" "}
                                            {d.recommended_fix}
                                        </div>
                                    )}
                                    <div className="mt-1.5 text-[11px] text-slate-400">
                                        {formatRelative(d.created_at)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            {/* Drift trend */}
            <section className="rounded-xl ring-1 ring-slate-200 bg-white">
                <div className="px-4 py-3 border-b border-slate-100">
                    <h2 className="text-sm font-semibold">Drift trend</h2>
                    <p className="text-xs text-slate-500">
                        Weekly average cosine similarity vs. the May-13 baseline. Anything
                        below the dashed threshold counts as drifted.
                    </p>
                </div>
                <div className="p-4">
                    <DriftChart data={driftTrend} />
                </div>
            </section>

            <footer className="pt-4 text-xs text-slate-400">
                Server-rendered every request · No caching · Reads directly from{" "}
                <span className="font-mono">obs.*</span> tables in Neon
            </footer>
        </main>
    );
}
