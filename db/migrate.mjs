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
    for (const file of files) {
        const sql = await readFile(join(migrationsDir, file), "utf8");
        process.stdout.write(`-> ${file} ... `);
        await client.query(sql);
        console.log("ok");
    }

    const tables = await client.query(`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema IN ('rag', 'obs')
        ORDER BY table_schema, table_name;
    `);

    console.log("\nSchema applied:");
    for (const row of tables.rows) {
        console.log(`  ${row.table_schema}.${row.table_name}`);
    }
} catch (err) {
    console.error(`\nMigration failed: ${err.message}`);
    process.exit(1);
} finally {
    await client.end();
}
