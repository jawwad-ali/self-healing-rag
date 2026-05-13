"use client";

import {
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

export type DriftPoint = {
    date: string;
    avg_cos: number;
    drifted_pct: number;
    n: number;
};

export default function DriftChart({ data }: { data: DriftPoint[] }) {
    const single = data.length <= 1;
    return (
        <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={data}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                    <XAxis
                        dataKey="date"
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: "#e2e8f0" }}
                    />
                    <YAxis
                        domain={[0.95, 1.0]}
                        ticks={[0.95, 0.97, 0.99, 1.0]}
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: "#e2e8f0" }}
                        tickFormatter={(v: number) => v.toFixed(2)}
                    />
                    <Tooltip
                        contentStyle={{
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                            fontSize: 12,
                        }}
                        formatter={(value: number, name: string) => {
                            if (name === "avg_cos") return [value.toFixed(5), "Avg cosine"];
                            if (name === "drifted_pct") return [`${value}%`, "Drifted"];
                            return [value, name];
                        }}
                    />
                    <ReferenceLine
                        y={0.95}
                        stroke="#fda4af"
                        strokeDasharray="3 3"
                        label={{
                            value: "drift threshold",
                            position: "insideBottomLeft",
                            fontSize: 10,
                            fill: "#9f1239",
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="avg_cos"
                        stroke="#4f46e5"
                        strokeWidth={2}
                        dot={{ r: single ? 5 : 3, fill: "#4f46e5" }}
                        activeDot={{ r: 6 }}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
            {single && (
                <p className="-mt-1 text-center text-[11px] text-slate-400">
                    Only one drift run so far. The line builds out as Phase 3 fires
                    each Sunday at 3am.
                </p>
            )}
        </div>
    );
}
