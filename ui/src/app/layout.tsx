import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
    title: "Self-Healing RAG Dashboard",
    description:
        "Live observability for the Cinder Analytics corpus — query log, eval scores, drift, agent diagnoses, canary comparison.",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="min-h-screen antialiased">
                <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
                    <nav className="mx-auto max-w-7xl px-6 py-3 flex items-center gap-5 text-sm">
                        <Link
                            href="/"
                            className="font-semibold text-slate-900 hover:text-slate-700 transition"
                        >
                            Self-Healing RAG
                        </Link>
                        <span className="text-slate-300">·</span>
                        <Link
                            href="/"
                            className="text-slate-600 hover:text-slate-900 transition"
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/corpus"
                            className="text-slate-600 hover:text-slate-900 transition"
                        >
                            Corpus
                        </Link>
                    </nav>
                </header>
                {children}
            </body>
        </html>
    );
}
