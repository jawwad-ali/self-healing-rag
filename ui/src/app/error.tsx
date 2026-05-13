"use client";

import { useEffect } from "react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <main className="mx-auto max-w-2xl px-6 py-16 text-center">
            <h2 className="text-xl font-semibold mb-2">Dashboard failed to load</h2>
            <p className="text-sm text-slate-500 mb-2">{error.message}</p>
            <p className="text-xs text-slate-400 mb-6">
                If this says <code className="font-mono">DATABASE_URL is missing</code>,
                copy <code className="font-mono">ui/.env.local.example</code> to{" "}
                <code className="font-mono">ui/.env.local</code> and fill in your Neon
                connection string.
            </p>
            <button
                onClick={() => reset()}
                className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition"
            >
                Try again
            </button>
        </main>
    );
}
