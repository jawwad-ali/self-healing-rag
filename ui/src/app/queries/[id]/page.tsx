import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import FeedbackButtons from "./feedback-buttons";

export const dynamic = "force-dynamic";

type RetrievedChunk = {
    id?: number | string;
    chunk_index?: number;
    document_id?: number | string;
    preview?: string;
};

type QueryRow = {
    id: number;
    question: string;
    answer: string | null;
    retrieved_chunks: RetrievedChunk[] | null;
    chat_model: string | null;
    embedding_model: string | null;
    retrieval_k: number | null;
    model_version: string | null;
    latency_ms: number | null;
    user_feedback: number | null;
    created_at: string;
};

type EvalRow = {
    id: number;
    judge_model: string;
    relevance: number;
    accuracy: number;
    completeness: number;
    overall: string;
    rationale: string | null;
    created_at: string;
};

type DiagnosisRow = {
    id: number;
    diagnosis: string;
    root_cause: string | null;
    recommended_fix: string | null;
    agent_model: string;
    created_at: string;
};

async function getQueryDetail(id: number) {
    const queryP = sql`
        SELECT id, question, answer, retrieved_chunks,
               chat_model, embedding_model, retrieval_k,
               model_version, latency_ms, user_feedback, created_at
        FROM obs.queries
        WHERE id = ${id}
        LIMIT 1
    `;
    const evalsP = sql`
        SELECT id, judge_model, relevance, accuracy, completeness, overall,
               rationale, created_at
        FROM obs.eval_runs
        WHERE query_id = ${id}
        ORDER BY created_at DESC
    `;
    const diagsP = sql`
        SELECT id, diagnosis, root_cause, recommended_fix, agent_model, created_at
        FROM obs.agent_diagnoses
        WHERE query_id = ${id}
        ORDER BY created_at DESC
    `;

    const [queryRows, evalRows, diagRows] = await Promise.all([
        queryP,
        evalsP,
        diagsP,
    ]);

    const row = queryRows[0] as unknown as QueryRow | undefined;
    if (!row) return null;

    return {
        query: row,
        evals: evalRows as unknown as EvalRow[],
        diagnoses: diagRows as unknown as DiagnosisRow[],
    };
}

function scoreColor(n: number): string {
    if (n >= 4.5) return "text-emerald-700 bg-emerald-50";
    if (n >= 3.5) return "text-amber-700 bg-amber-50";
    return "text-rose-700 bg-rose-50";
}

function ScorePill({ label, value }: { label: string; value: number }) {
    return (
        <div
            className={`rounded-lg px-3 py-2 ring-1 ring-inset ring-slate-200 ${scoreColor(value)}`}
        >
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                {label}
            </div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums">
                {value}
                <span className="text-xs text-slate-400">/5</span>
            </div>
        </div>
    );
}

export default async function QueryDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const numId = Number.parseInt(id, 10);
    if (!Number.isFinite(numId) || numId <= 0) notFound();

    const detail = await getQueryDetail(numId);
    if (!detail) notFound();

    const { query: q, evals, diagnoses } = detail;
    const chunks = Array.isArray(q.retrieved_chunks) ? q.retrieved_chunks : [];

    return (
        <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
            <div>
                <Link
                    href="/"
                    className="text-xs text-slate-500 hover:text-slate-800 transition"
                >
                    ← Back to dashboard
                </Link>
            </div>

            <header className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono">query #{q.id}</span>
                    <span>·</span>
                    <time dateTime={q.created_at}>
                        {new Date(q.created_at).toLocaleString()}
                    </time>
                    {q.model_version && (
                        <>
                            <span>·</span>
                            <span className="font-mono">{q.model_version}</span>
                        </>
                    )}
                </div>
                <h1 className="text-xl font-semibold tracking-tight">
                    {q.question}
                </h1>
            </header>

            {/* Answer card */}
            <section className="rounded-xl ring-1 ring-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <h2 className="text-sm font-semibold text-slate-700">Answer</h2>
                    <FeedbackButtons queryId={q.id} initial={q.user_feedback} />
                </div>
                <div className="text-sm text-slate-800 whitespace-pre-wrap">
                    {q.answer ?? <span className="text-slate-400">(no answer recorded)</span>}
                </div>
            </section>

            {/* Eval card */}
            {evals.length > 0 && (
                <section className="rounded-xl ring-1 ring-slate-200 bg-white p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-700">
                            Judge evaluation
                        </h2>
                        <span className="text-xs text-slate-400">
                            judged by {evals[0].judge_model} ·{" "}
                            {new Date(evals[0].created_at).toLocaleString()}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <ScorePill label="Relevance" value={evals[0].relevance} />
                        <ScorePill label="Accuracy" value={evals[0].accuracy} />
                        <ScorePill label="Completeness" value={evals[0].completeness} />
                        <ScorePill
                            label="Overall"
                            value={Number(evals[0].overall)}
                        />
                    </div>
                    {evals[0].rationale && (
                        <div className="text-sm text-slate-600 italic border-l-2 border-slate-200 pl-4">
                            “{evals[0].rationale}”
                        </div>
                    )}
                    {evals.length > 1 && (
                        <div className="text-xs text-slate-400">
                            + {evals.length - 1} earlier evaluation
                            {evals.length - 1 === 1 ? "" : "s"} of this query
                        </div>
                    )}
                </section>
            )}

            {/* Agent diagnosis */}
            {diagnoses.length > 0 && (
                <section className="rounded-xl ring-1 ring-indigo-200 bg-indigo-50/30 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-indigo-900">
                            Agent diagnosis
                        </h2>
                        <span className="text-xs text-slate-500">
                            {diagnoses[0].agent_model} ·{" "}
                            {new Date(diagnoses[0].created_at).toLocaleString()}
                        </span>
                    </div>
                    <p className="text-sm text-slate-800">{diagnoses[0].diagnosis}</p>
                    {diagnoses[0].root_cause && (
                        <div className="text-sm">
                            <span className="font-semibold text-slate-700">
                                Root cause:{" "}
                            </span>
                            <span className="text-slate-700">
                                {diagnoses[0].root_cause}
                            </span>
                        </div>
                    )}
                    {diagnoses[0].recommended_fix && (
                        <div className="text-sm">
                            <span className="font-semibold text-emerald-900">
                                Recommended fix:{" "}
                            </span>
                            <span className="text-emerald-900">
                                {diagnoses[0].recommended_fix}
                            </span>
                        </div>
                    )}
                </section>
            )}

            {/* Retrieved chunks */}
            <section className="rounded-xl ring-1 ring-slate-200 bg-white p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-700">
                    Retrieved chunks{" "}
                    <span className="text-slate-400 font-normal">
                        (top-{q.retrieval_k ?? chunks.length})
                    </span>
                </h2>
                {chunks.length === 0 ? (
                    <p className="text-sm text-slate-400">
                        No retrieved chunks recorded for this query.
                    </p>
                ) : (
                    <ol className="space-y-3">
                        {chunks.map((c, i) => (
                            <li
                                key={c.id ?? i}
                                className="rounded-lg ring-1 ring-slate-200 bg-slate-50 p-3"
                            >
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1">
                                    <span className="font-mono">
                                        chunk_id={c.id ?? "—"}
                                    </span>
                                    {c.chunk_index !== undefined && (
                                        <>
                                            <span>·</span>
                                            <span>index {c.chunk_index}</span>
                                        </>
                                    )}
                                </div>
                                <div className="text-sm text-slate-700 whitespace-pre-wrap">
                                    {c.preview ?? "(no preview)"}
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </section>

            {/* Metadata */}
            <section className="rounded-xl ring-1 ring-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">
                    Request metadata
                </h2>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <Meta label="Chat model" value={q.chat_model} />
                    <Meta label="Embedding model" value={q.embedding_model} />
                    <Meta label="k" value={q.retrieval_k?.toString() ?? "—"} />
                    <Meta
                        label="Latency"
                        value={q.latency_ms != null ? `${q.latency_ms} ms` : "—"}
                    />
                </dl>
            </section>
        </main>
    );
}

function Meta({ label, value }: { label: string; value: string | null }) {
    return (
        <div>
            <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                {label}
            </dt>
            <dd className="mt-0.5 font-mono text-slate-800">{value ?? "—"}</dd>
        </div>
    );
}
