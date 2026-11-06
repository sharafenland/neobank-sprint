/** All database access lives here, so the route handlers stay thin. */
import { sql } from "./db";
import { BOTS, botPlay, newBotState } from "./bots";
import { makeCode, makeToken } from "./derive";
import { syncToPhase } from "./engine";
import { emptyTeamState, settledPortfolio } from "./rules";
import type { BotKind, SessionRow, TeamState } from "./types";

export interface TeamRow {
  id: string;
  name: string;
  token: string;
  state: TeamState;
}

export async function createSession(sprints: number, slots: number, teaching: boolean, solo = false) {
  const hostToken = makeToken();
  const seed = Math.floor(Math.random() * 2 ** 31);

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode();
    const rows = (await sql`
      insert into sessions (code, seed, sprints, slots, teaching, solo, host_token)
      values (${code}, ${seed}, ${sprints}, ${slots}, ${teaching}, ${solo}, ${hostToken})
      on conflict (code) do nothing
      returning code
    `) as unknown as { code: string }[];
    if (rows.length) return { code, hostToken };
  }
  throw new Error("Could not allocate a free access code. Try again.");
}

export async function getSession(code: string): Promise<SessionRow | null> {
  const rows = (await sql`
    select code, seed, sprints, slots, teaching, solo, sprint, phase, reveal_incident, reveal_event, finished
    from sessions where code = ${code}
  `) as unknown as SessionRow[];
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
  `) as unknown as TeamRow[];
}

/** What the engine needs to know about every group in the room. */
export function rosterEntry(t: TeamRow) {
  return { name: t.name, customers: t.state.customers, bugs: t.state.bugs, owned: settledPortfolio(t.state) };
}

export async function getTeamByToken(code: string, token: string | null): Promise<TeamRow | null> {
  if (!token) return null;
  const rows = (await sql`
    select id::text, name, token, state from teams where code = ${code} and token = ${token}
  `) as unknown as TeamRow[];
  return rows[0] ?? null;
}

export async function saveTeam(id: string, state: TeamState) {
  await sql`update teams set state = ${JSON.stringify(state)}::jsonb, updated_at = now() where id = ${id}::uuid`;
}

export async function joinTeam(session: SessionRow, name: string) {
  const existing = (await sql`
    select id::text, name, token, state from teams where code = ${session.code} and lower(name) = lower(${name})
  `) as unknown as TeamRow[];
  if (existing.length) {
    // A bot's name must not be a way to take over the bot.
    if (existing[0].state.bot) throw new Error("A bot already plays under that name. Pick another.");
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

/** Cards start face down, except in a solo game, where nobody else would turn them. */
export async function setPhase(code: string, sprint: number, phase: number, finished: boolean, solo = false) {
  await sql`
    update sessions
       set sprint = ${sprint}, phase = ${phase}, finished = ${finished},
           reveal_incident = ${solo}, reveal_event = ${solo}, updated_at = now()
     where code = ${code}
  `;
}

export async function addBot(session: SessionRow, kind: BotKind) {
  const taken = new Set((await listTeams(session.code)).map((t) => t.name.toLowerCase()));
  let name = BOTS[kind].name;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${BOTS[kind].name} ${n}`;
  await sql`
    insert into teams (code, name, token, state)
    values (${session.code}, ${name}, ${makeToken()}, ${JSON.stringify(newBotState(kind, session))}::jsonb)
  `;
  return name;
}

/**
 * Lets every bot in the room make the moves the current phase allows. Called
 * whenever the room changes: a new phase, a card turned over, a bot added.
 */
export async function playBots(session: SessionRow) {
  const teams = await listTeams(session.code);
  if (!teams.some((t) => t.state.bot)) return;
  const roster = () => teams.map((t) => rosterEntry(t));
  for (const t of teams) {
    if (!t.state.bot) continue;
    botPlay(t.state, session, roster());
    await saveTeam(t.id, t.state);
  }
}

export async function setSprints(code: string, sprints: number) {
  await sql`update sessions set sprints = ${sprints}, updated_at = now() where code = ${code}`;
}

export async function setTeaching(code: string, on: boolean) {
  await sql`update sessions set teaching = ${on}, updated_at = now() where code = ${code}`;
}

export async function finishSession(code: string) {
  await sql`update sessions set finished = true, updated_at = now() where code = ${code}`;
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
