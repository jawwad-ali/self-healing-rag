import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
    throw new Error(
        "DATABASE_URL is missing. Copy ui/.env.local.example to ui/.env.local and fill it in.",
    );
}

export const sql = neon(process.env.DATABASE_URL);
