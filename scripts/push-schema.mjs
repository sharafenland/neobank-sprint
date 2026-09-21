/* Applies db/schema.sql to the database in DATABASE_URL. Safe to re-run. */
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

const isNeon = /\.neon\.(tech|build)/.test(url);
const run = isNeon
  ? await (async () => {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(url);
      return (statement) => sql.query(statement);
    })()
  : await (async () => {
      const { Client } = await import("pg");
      const client = new Client({ connectionString: url });
      await client.connect();
      return (statement) => client.query(statement);
    })();

const statements = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  await run(statement);
  console.log("ok:", statement.split("\n")[0].slice(0, 72));
}
console.log(`\nApplied ${statements.length} statements.`);
process.exit(0);
