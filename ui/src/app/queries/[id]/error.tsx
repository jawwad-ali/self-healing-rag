"use client";

import Link from "next/link";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <main className="mx-auto max-w-2xl px-6 py-16 text-center">
            <h2 className="text-xl font-semibold mb-2">Couldn&apos;t load this query</h2>
            <p className="text-sm text-slate-500 mb-6">{error.message}</p>
            <div className="flex items-center justify-center gap-3">
                <button
                    onClick={() => reset()}
                    className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition"
                >
                    Try again
                </button>
                <Link
                    href="/"
                    className="px-4 py-2 text-sm bg-white ring-1 ring-slate-200 rounded-lg hover:bg-slate-50 transition"
                >
                    Back to dashboard
                </Link>
            </div>
        </main>
    );
}
