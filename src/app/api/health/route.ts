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

type Result = { ok: boolean; step: string; detail: string; driver?: string };

const reply = (r: Result, status: number) => NextResponse.json(r, { status });

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
      { ok: true, step: "ready", driver, detail: `Schema present — ${sessions} sessions, ${teams} teams.` },
      200,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const missing = /does not exist/i.test(msg);
    return reply(
      {
        ok: false,
        step: "schema",
        driver,
        detail: missing ? `${msg} — run \`npm run db:push\`, or paste db/schema.sql into the Neon SQL editor.` : msg,
      },
      503,
    );
  }
}
