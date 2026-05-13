"use client";

import { useState, useTransition } from "react";
import { submitFeedback } from "@/app/actions/feedback";

export default function FeedbackButtons({
    queryId,
    initial,
}: {
    queryId: number;
    initial: number | null;
}) {
    const [value, setValue] = useState<number>(initial ?? 0);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const cast = (next: -1 | 1) => {
        // Toggle off if user clicks the same button.
        const target: -1 | 0 | 1 = value === next ? 0 : next;
        setValue(target);
        setError(null);
        startTransition(async () => {
            const r = await submitFeedback(queryId, target);
            if (!r.ok) {
                setError(r.error);
                setValue(initial ?? 0);
            }
        });
    };

    const baseBtn =
        "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ring-1 transition disabled:opacity-50";
    const upActive = "bg-emerald-50 ring-emerald-300 text-emerald-800";
    const upIdle = "bg-white ring-slate-200 text-slate-600 hover:bg-slate-50";
    const downActive = "bg-rose-50 ring-rose-300 text-rose-800";
    const downIdle = "bg-white ring-slate-200 text-slate-600 hover:bg-slate-50";

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                disabled={isPending}
                onClick={() => cast(1)}
                aria-pressed={value === 1}
                className={`${baseBtn} ${value === 1 ? upActive : upIdle}`}
            >
                <span aria-hidden>▲</span>
                Helpful
            </button>
            <button
                type="button"
                disabled={isPending}
                onClick={() => cast(-1)}
                aria-pressed={value === -1}
                className={`${baseBtn} ${value === -1 ? downActive : downIdle}`}
            >
                <span aria-hidden>▼</span>
                Not helpful
            </button>
            {isPending && (
                <span className="text-xs text-slate-400">saving…</span>
            )}
            {error && (
                <span className="text-xs text-rose-600">error: {error}</span>
            )}
        </div>
    );
}
