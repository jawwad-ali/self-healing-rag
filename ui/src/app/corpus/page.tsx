import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type CorpusRow = {
    id: number;
    chunk_index: number;
    preview: string;
    content_hash: string;
    embedding_model: string;
    content_length: number;
    created_at: string;
    updated_at: string;
    latest_drift: string | null;
    latest_drift_at: string | null;
};

type DocRow = {
    id: number;
    source: string;
    title: string | null;
    content_hash: string;
    updated_at: string;
    chunk_count: number;
};

async function getCorpus() {
    const docP = sql`
        SELECT
            d.id, d.source, d.title, d.content_hash, d.updated_at,
            (SELECT count(*)::int FROM rag.chunks c WHERE c.document_id = d.id) AS chunk_count
        FROM rag.documents d
        ORDER BY d.id ASC
        LIMIT 5
    `;
    const chunksP = sql`
        SELECT
            c.id,
            c.chunk_index,
            left(c.content, 140) AS preview,
            c.content_hash,
            c.embedding_model,
            length(c.content)::int AS content_length,
            c.created_at,
            c.updated_at,
            (SELECT cosine_to_base FROM obs.drift_scores ds
              WHERE ds.chunk_id = c.id
              ORDER BY measured_at DESC LIMIT 1) AS latest_drift,
            (SELECT measured_at FROM obs.drift_scores ds
              WHERE ds.chunk_id = c.id
              ORDER BY measured_at DESC LIMIT 1) AS latest_drift_at
        FROM rag.chunks c
        ORDER BY c.document_id ASC, c.chunk_index ASC
    `;
    const [docs, chunks] = await Promise.all([docP, chunksP]);
    return {
        docs: docs as unknown as DocRow[],
        chunks: chunks as unknown as CorpusRow[],
    };
}

function driftTone(d: string | null): string {
    if (d == null) return "text-slate-400";
    const n = Number(d);
    if (n >= 0.99) return "text-emerald-700";
    if (n >= 0.95) return "text-amber-700";
    return "text-rose-700";
}

function formatRelative(iso: string | null): string {
    if (!iso) return "—";
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    if (sec < 86400 * 30) return `${Math.floor(sec / 86400)}d ago`;
    return new Date(iso).toLocaleDateString();
}

export default async function CorpusPage() {
    const { docs, chunks } = await getCorpus();

    const driftedCount = chunks.filter(
        (c) => c.latest_drift != null && Number(c.latest_drift) < 0.95,
    ).length;

    return (
        <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
            <header>
                <h1 className="text-2xl font-semibold tracking-tight">
                    Corpus inventory
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                    All chunks indexed in <span className="font-mono">rag.chunks</span>,
                    annotated with the most recent drift measurement per chunk.
                </p>
            </header>

            {/* Documents summary */}
            <section className="rounded-xl ring-1 ring-slate-200 bg-white">
                <div className="px-4 py-3 border-b border-slate-100">
                    <h2 className="text-sm font-semibold">Documents</h2>
                </div>
                <ul className="divide-y divide-slate-100">
                    {docs.map((d) => (
                        <li
                            key={d.id}
                            className="px-4 py-3 flex items-center gap-4 text-sm"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                    {d.title ?? d.source}
                                </div>
                                <div className="text-xs text-slate-500 font-mono truncate">
                                    {d.source}
                                </div>
                            </div>
                            <div className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
                                {d.chunk_count} chunks
                            </div>
                            <div className="text-xs text-slate-400 font-mono whitespace-nowrap">
                                hash {d.content_hash || "—"}
                            </div>
                            <div className="text-xs text-slate-400 whitespace-nowrap">
                                updated {formatRelative(d.updated_at)}
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            {/* Chunks table */}
            <section className="rounded-xl ring-1 ring-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold">Chunks</h2>
                        <p className="text-xs text-slate-500">
                            {chunks.length} total ·{" "}
                            <span
                                className={
                                    driftedCount === 0
                                        ? "text-emerald-700"
                                        : "text-rose-700"
                                }
                            >
                                {driftedCount} drifted
                            </span>{" "}
                            (cosine &lt; 0.95)
                        </p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium">#</th>
                                <th className="px-4 py-2 text-left font-medium">Preview</th>
                                <th className="px-4 py-2 text-left font-medium">Hash</th>
                                <th className="px-4 py-2 text-right font-medium">Length</th>
                                <th className="px-4 py-2 text-left font-medium">
                                    Embedding model
                                </th>
                                <th className="px-4 py-2 text-right font-medium">Drift</th>
                                <th className="px-4 py-2 text-left font-medium">
                                    Updated
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {chunks.map((c) => (
                                <tr key={c.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-2 text-xs tabular-nums text-slate-500 whitespace-nowrap">
                                        {c.chunk_index}
                                    </td>
                                    <td className="px-4 py-2 max-w-md">
                                        <div className="truncate text-slate-700">
                                            {c.preview}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 text-xs font-mono text-slate-500 whitespace-nowrap">
                                        {c.content_hash}
                                    </td>
                                    <td className="px-4 py-2 text-xs tabular-nums text-slate-500 text-right whitespace-nowrap">
                                        {c.content_length}
                                    </td>
                                    <td className="px-4 py-2 text-xs font-mono text-slate-500 whitespace-nowrap">
                                        {c.embedding_model}
                                    </td>
                                    <td
                                        className={`px-4 py-2 text-xs tabular-nums text-right whitespace-nowrap ${driftTone(c.latest_drift)}`}
                                    >
                                        {c.latest_drift != null
                                            ? Number(c.latest_drift).toFixed(5)
                                            : "—"}
                                    </td>
                                    <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                                        {formatRelative(c.updated_at)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <footer className="pt-2 text-xs text-slate-400">
                Drift values are from the most recent{" "}
                <span className="font-mono">obs.drift_scores</span> row per chunk. Phase
                3&apos;s cron re-runs every Sunday at 3am UTC.
            </footer>
        </main>
    );
}
