import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "migrations");

const url = process.env.DATABASE_URL;
if (!url) {
    console.error("DATABASE_URL missing from .env");
    process.exit(1);
}

const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

if (files.length === 0) {
    console.log("No migration files found.");
    process.exit(0);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
    await client.query(`
        CREATE TABLE IF NOT EXISTS public._migrations (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    `);

    const { rows: applied } = await client.query(
        `SELECT filename FROM public._migrations`
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    for (const file of files) {
        if (appliedSet.has(file)) {
            console.log(`-> ${file} ... (already applied)`);
            continue;
        }
        const sql = await readFile(join(migrationsDir, file), "utf8");
        process.stdout.write(`-> ${file} ... `);
        await client.query("BEGIN");
        try {
            await client.query(sql);
            await client.query(
                `INSERT INTO public._migrations (filename) VALUES ($1)`,
                [file]
            );
            await client.query("COMMIT");
            console.log("ok");
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        }
    }

    const tables = await client.query(`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema IN ('rag', 'obs')
        ORDER BY table_schema, table_name;
    `);

    console.log("\nSchema present:");
    for (const row of tables.rows) {
        console.log(`  ${row.table_schema}.${row.table_name}`);
    }
} catch (err) {
    console.error(`\nMigration failed: ${err.message}`);
    process.exit(1);
} finally {
    await client.end();
}
