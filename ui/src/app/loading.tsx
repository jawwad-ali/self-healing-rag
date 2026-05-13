export default function Loading() {
    return (
        <main className="mx-auto max-w-7xl px-6 py-8 space-y-8 animate-pulse">
            <div>
                <div className="h-7 w-72 bg-slate-200 rounded" />
                <div className="mt-2 h-4 w-96 bg-slate-100 rounded" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="h-24 bg-white border border-slate-200 rounded-xl"
                    />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-96 bg-white border border-slate-200 rounded-xl" />
                <div className="h-96 bg-white border border-slate-200 rounded-xl" />
            </div>
        </main>
    );
}
