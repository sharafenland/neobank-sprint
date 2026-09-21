import { NextResponse } from "next/server";
import { eventIdFor, incidentIdFor, marketFor } from "@/lib/derive";
import { phaseDone } from "@/lib/engine";
import { getSession, getTeamByToken, isHost, listTeams } from "@/lib/store";
import type { GameView } from "@/lib/types";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const session = await getSession(code.toUpperCase());
  if (!session) return NextResponse.json({ error: "No session with that code." }, { status: 404 });

  const teamToken = req.headers.get("x-team-token");
  const hostToken = req.headers.get("x-host-token");
  const [teams, host, you] = await Promise.all([
    listTeams(session.code),
    isHost(session.code, hostToken),
    getTeamByToken(session.code, teamToken),
  ]);

  const view: GameView & { isHost: boolean } = {
    session,
    market: marketFor(session.seed, session.sprint),
    incidentId: incidentIdFor(session.seed, session.sprint),
    eventId: eventIdFor(session.seed, session.sprint),
    isHost: host,
    teams: teams.map((t) => ({
      name: t.name,
      customers: t.state.customers,
      bugs: t.state.bugs,
      findings: t.state.findings,
      ip: t.state.ip,
      practices: t.state.practices,
      // Other groups' picks stay hidden until planning is over.
      picked: session.phase > 0 || host ? t.state.picked : [],
      confirmed: t.state.confirmed,
      phaseDone: phaseDone(t.state, session),
    })),
    ...(you ? { you: { name: you.name, state: you.state } } : {}),
  };

  return NextResponse.json(view, { headers: { "cache-control": "no-store" } });
}
