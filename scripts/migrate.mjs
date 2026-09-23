// Apply db/migrations/*.sql to the database in DATABASE_URL, in order, once.
//
//   DATABASE_URL=postgres://… npm run db:migrate
//
// Each file runs inside its own transaction and is recorded in
// schema_migrations, so re-running is safe. Use Neon's direct (non-pooled)
// connection string for migrations; the apps use the pooled one.
//
//   npm run db:migrate -- --list    show which files are applied / pending
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "db", "migrations");
const files = readdirSync(dir)
  .filter((f) => /^\d{3}_[a-z0-9_]+\.sql$/.test(f))
  .sort();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set. Nothing was changed.\n" +
      "Set it to the Neon connection string, then run: npm run db:migrate",
  );
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: /sslmode=disable/.test(url) ? false : { rejectUnauthorized: true },
});
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const done = new Set(
    (await client.query("SELECT name FROM schema_migrations")).rows.map(
      (r) => r.name,
    ),
  );
  if (process.argv.includes("--list")) {
    for (const f of files)
      console.log(`${done.has(f) ? "applied" : "pending"}  ${f}`);
  } else {
    let applied = 0;
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = readFileSync(path.join(dir, f), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
          f,
        ]);
        await client.query("COMMIT");
        console.log(`applied  ${f}`);
        applied++;
      } catch (error) {
        await client.query("ROLLBACK");
        console.error(`failed   ${f}: ${error.message}`);
        process.exitCode = 1;
        break;
      }
    }
    if (!applied && !process.exitCode) console.log("Up to date.");
  }
} finally {
  await client.end();
}
