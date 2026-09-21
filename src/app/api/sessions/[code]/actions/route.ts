import { NextResponse } from "next/server";
import { GameError, applyAction, syncToPhase, type Action } from "@/lib/engine";
import { getSession, getTeamByToken, listTeams, saveTeam, writeAudit } from "@/lib/store";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const session = await getSession(code.toUpperCase());
  if (!session) return NextResponse.json({ error: "No session with that code." }, { status: 404 });
  if (session.finished) return NextResponse.json({ error: "The session is over." }, { status: 409 });

  const team = await getTeamByToken(session.code, req.headers.get("x-team-token"));
  if (!team) return NextResponse.json({ error: "Join the session first." }, { status: 401 });

  const action = (await req.json().catch(() => null)) as Action | null;
  if (!action || typeof action.kind !== "string") {
    return NextResponse.json({ error: "Malformed action." }, { status: 400 });
  }

  const roster = (await listTeams(session.code)).map((t) => ({
    name: t.name,
    customers: t.state.customers,
    bugs: t.state.bugs,
  }));

  try {
    const state = applyAction(syncToPhase(team.state, session), session, roster, action);
    await saveTeam(team.id, state);
    await writeAudit(session.code, team.name, session.sprint, session.phase, action.kind, action);
    return NextResponse.json({ ok: true, state });
  } catch (err) {
    if (err instanceof GameError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
