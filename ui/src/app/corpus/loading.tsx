export default function Loading() {
    return (
        <main className="mx-auto max-w-7xl px-6 py-8 space-y-6 animate-pulse">
            <div className="h-7 w-48 bg-slate-200 rounded" />
            <div className="h-4 w-96 bg-slate-100 rounded" />
            <div className="rounded-xl ring-1 ring-slate-200 bg-white">
                <div className="h-10 border-b border-slate-100" />
                {Array.from({ length: 12 }).map((_, i) => (
                    <div
                        key={i}
                        className="h-12 border-b border-slate-100 last:border-none"
                    />
                ))}
            </div>
        </main>
    );
}
