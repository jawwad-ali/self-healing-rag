export default function Loading() {
    return (
        <main className="mx-auto max-w-5xl px-6 py-8 space-y-6 animate-pulse">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="space-y-2">
                <div className="h-7 w-2/3 bg-slate-200 rounded" />
                <div className="h-4 w-1/3 bg-slate-100 rounded" />
            </div>
            <div className="h-32 bg-white border border-slate-200 rounded-xl" />
            <div className="h-48 bg-white border border-slate-200 rounded-xl" />
            <div className="h-64 bg-white border border-slate-200 rounded-xl" />
        </main>
    );
}
