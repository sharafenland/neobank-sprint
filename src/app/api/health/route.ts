/**
 * Deployment check: is this instance able to talk to its database?
 *
 * A failing action otherwise surfaces as a bare 500, because Next hides
 * exception messages in production. This names the step that failed —
 * missing URL, unreachable host, missing schema — without ever echoing
 * the connection string or the host it points at.
 */
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Never prerender: this must run per request, and `next build` has no database.
export const dynamic = "force-dynamic";

type Result = {
  ok: boolean;
  step: string;
  detail: string;
  driver?: string;
  /** Which database this instance actually reached — not which one you meant. */
  target?: { endpoint: string | null; database?: string | null; tables?: string[] };
};

const reply = (r: Result, status: number) => NextResponse.json(r, { status });

/**
 * The Neon endpoint id, truncated. Each Neon branch has its own endpoint, so
 * this is what tells "schema never applied" apart from "applied, but to the
 * branch behind a different environment". The random suffix is dropped: enough
 * to recognise in the Neon console, not enough to be a handle on the host.
 */
function endpointHint(url: string): string | null {
  const host = url.match(/@([^/:?]+)/)?.[1];
  const first = host?.split(".")[0];
  if (!first?.startsWith("ep-")) return null;
  return first.split("-").slice(0, -1).join("-") + "-\u2026";
}

/** What the reached database does contain, so an empty list speaks for itself. */
async function inventory(url: string): Promise<Result["target"]> {
  let database: string | null = null;
  let tables: string[] = [];
  try {
    const rows = (await sql`select current_database() as db`) as unknown as { db: string }[];
    database = rows[0]?.db ?? null;
  } catch {
    // Leave it null — the step that follows reports the real failure.
  }
  try {
    const rows = (await sql`
      select table_name from information_schema.tables
      where table_schema = 'public' order by table_name
    `) as unknown as { table_name: string }[];
    tables = rows.map((r) => r.table_name);
  } catch {
    // Same.
  }
  return { endpoint: endpointHint(url), database, tables };
}

export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return reply(
      {
        ok: false,
        step: "env",
        detail: "DATABASE_URL is not set for this environment. Vercel keeps variables per environment (Production, Preview, Development) and bakes them in at deploy time — set it for the one you are hitting, then redeploy.",
      },
      503,
    );
  }

  const driver = /\.neon\.(tech|build)/.test(url) ? "neon-http" : "node-postgres";

  try {
    await sql`select 1`;
  } catch (e) {
    return reply(
      { ok: false, step: "connect", driver, detail: e instanceof Error ? e.message : String(e) },
      503,
    );
  }

  try {
    const rows = (await sql`
      select
        (select count(*) from sessions) as sessions,
        (select count(*) from teams) as teams
    `) as unknown as { sessions: string; teams: string }[];
    const { sessions, teams } = rows[0];
    return reply(
      {
        ok: true,
        step: "ready",
        driver,
        detail: `Schema present — ${sessions} sessions, ${teams} teams.`,
        target: { endpoint: endpointHint(url) },
      },
      200,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const missing = /does not exist/i.test(msg);
    const target = await inventory(url);
    const hint = target?.tables?.length
      ? "That database holds other tables, so the connection is fine but the schema was applied somewhere else — check you are on the right Neon branch."
      : "That database is empty — run `npm run db:push` against it, or paste db/schema.sql into the Neon SQL editor. If you did apply it, you applied it to a different Neon branch than this environment points at.";
    return reply(
      { ok: false, step: "schema", driver, detail: missing ? `${msg} — ${hint}` : msg, target },
      503,
    );
  }
}
