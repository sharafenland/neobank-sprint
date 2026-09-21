/**
 * One tagged-template `sql` over two drivers.
 *
 * On Vercel the connection string points at Neon and we use its HTTP driver,
 * which is what works from a serverless function. Against any other host —
 * a Postgres container on a laptop, CI — we fall back to node-postgres, so
 * the project can be developed and tested without a cloud account.
 *
 * Both are resolved lazily: `next build` must not need a database, and a
 * missing URL should fail with a readable message at request time.
 */
import { neon } from "@neondatabase/serverless";

type Row = Record<string, unknown>;
type Tagged = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;
type Sql = Tagged & { query: (text: string, params?: unknown[]) => Promise<Row[]> };

const isNeonHost = (url: string) => /\.neon\.(tech|build)/.test(url);

async function build(): Promise<Sql> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Attach the Neon integration in Vercel, or fill in .env.local.");

  if (isNeonHost(url)) {
    const client = neon(url);
    const tagged = ((s, ...v) => client(s, ...v) as Promise<Row[]>) as Sql;
    tagged.query = (text, params) => client.query(text, params ?? []) as Promise<Row[]>;
    return tagged;
  }

  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 5 });
  const tagged = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    // Template holes become $1, $2, … so values are always bound, never interpolated.
    const text = strings.reduce((acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""), "");
    const { rows } = await pool.query(text, values as unknown[]);
    return rows as Row[];
  }) as Sql;
  tagged.query = async (text, params) => (await pool.query(text, (params ?? []) as unknown[])).rows as Row[];
  return tagged;
}

let ready: Promise<Sql> | null = null;
const resolve = () => (ready ??= build());

export const sql = new Proxy((() => {}) as unknown as Sql, {
  apply: (_target, _thisArg, args: unknown[]) =>
    resolve().then((fn) => (fn as unknown as (...a: unknown[]) => Promise<Row[]>)(...args)),
  get: (_target, prop) => {
    // Never look thenable: awaiting `sql` itself is always a mistake.
    if (prop === "then" || typeof prop === "symbol") return undefined;
    return (...args: unknown[]) =>
      resolve().then((fn) => (fn as unknown as Record<string, (...a: unknown[]) => Promise<Row[]>>)[prop as string](...args));
  },
});
