/** All database access lives here, so the route handlers stay thin. */
import { sql } from "./db";
import { makeCode, makeToken } from "./derive";
import { syncToPhase } from "./engine";
import { emptyTeamState } from "./rules";
import type { SessionRow, TeamState } from "./types";

export interface TeamRow {
  id: string;
  name: string;
  token: string;
  state: TeamState;
}

export async function createSession(sprints: number) {
  const hostToken = makeToken();
  const seed = Math.floor(Math.random() * 2 ** 31);

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode();
    const rows = (await sql`
      insert into sessions (code, seed, sprints, host_token)
      values (${code}, ${seed}, ${sprints}, ${hostToken})
      on conflict (code) do nothing
      returning code
    `) as { code: string }[];
    if (rows.length) return { code, hostToken };
  }
  throw new Error("Could not allocate a free access code. Try again.");
}

export async function getSession(code: string): Promise<SessionRow | null> {
  const rows = (await sql`
    select code, seed, sprints, sprint, phase, reveal_incident, reveal_event, finished
    from sessions where code = ${code}
  `) as SessionRow[];
  return rows[0] ?? null;
}

export async function isHost(code: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  const rows = (await sql`select 1 from sessions where code = ${code} and host_token = ${token}`) as unknown[];
  return rows.length > 0;
}

export async function listTeams(code: string): Promise<TeamRow[]> {
  return (await sql`
    select id::text, name, token, state from teams where code = ${code} order by created_at
  `) as TeamRow[];
}

export async function getTeamByToken(code: string, token: string | null): Promise<TeamRow | null> {
  if (!token) return null;
  const rows = (await sql`
    select id::text, name, token, state from teams where code = ${code} and token = ${token}
  `) as TeamRow[];
  return rows[0] ?? null;
}

export async function saveTeam(id: string, state: TeamState) {
  await sql`update teams set state = ${JSON.stringify(state)}::jsonb, updated_at = now() where id = ${id}::uuid`;
}

export async function joinTeam(session: SessionRow, name: string) {
  const existing = (await sql`
    select id::text, name, token, state from teams where code = ${session.code} and lower(name) = lower(${name})
  `) as TeamRow[];
  if (existing.length) {
    // Rejoining from a new device is allowed — the group keeps its progress.
    return { token: existing[0].token, rejoined: true };
  }

  const token = makeToken();
  const state = syncToPhase(emptyTeamState(), session);
  await sql`
    insert into teams (code, name, token, state)
    values (${session.code}, ${name}, ${token}, ${JSON.stringify(state)}::jsonb)
  `;
  return { token, rejoined: false };
}

export async function setPhase(code: string, sprint: number, phase: number, finished: boolean) {
  await sql`
    update sessions
       set sprint = ${sprint}, phase = ${phase}, finished = ${finished},
           reveal_incident = false, reveal_event = false, updated_at = now()
     where code = ${code}
  `;
}

export async function setReveal(code: string, which: "incident" | "event") {
  if (which === "incident") {
    await sql`update sessions set reveal_incident = true, updated_at = now() where code = ${code}`;
  } else {
    await sql`update sessions set reveal_event = true, updated_at = now() where code = ${code}`;
  }
}

export async function writeAudit(code: string, teamName: string | null, sprint: number, phase: number, kind: string, detail: unknown) {
  await sql`
    insert into audit_log (code, team_name, sprint, phase, kind, detail)
    values (${code}, ${teamName}, ${sprint}, ${phase}, ${kind}, ${JSON.stringify(detail ?? {})}::jsonb)
  `;
}
