import { NextResponse } from "next/server";
import { PHASES } from "@/lib/cards";
import { syncToPhase } from "@/lib/engine";
import { getSession, isHost, listTeams, saveTeam, setPhase, setReveal, writeAudit } from "@/lib/store";

/** Only the facilitator moves the room. Groups follow. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const session = await getSession(code.toUpperCase());
  if (!session) return NextResponse.json({ error: "No session with that code." }, { status: 404 });
  if (!(await isHost(session.code, req.headers.get("x-host-token")))) {
    return NextResponse.json({ error: "Only the facilitator can move the room." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const op = String(body.op ?? "");

  if (op === "revealIncident" || op === "revealEvent") {
    await setReveal(session.code, op === "revealIncident" ? "incident" : "event");
    return NextResponse.json({ ok: true });
  }

  let { sprint, phase } = session;
  let finished = session.finished;

  if (op === "next") {
    if (PHASES[phase].id === "retro") {
      if (sprint >= session.sprints) finished = true;
      else { sprint += 1; phase = 0; }
    } else phase += 1;
  } else if (op === "back") {
    if (phase > 0) phase -= 1;
    else if (sprint > 1) { sprint -= 1; phase = PHASES.length - 1; }
  } else {
    return NextResponse.json({ error: "Unknown operation." }, { status: 400 });
  }

  await setPhase(session.code, sprint, phase, finished);

  // Apply whatever the new phase does to each group, once.
  const next = { ...session, sprint, phase, finished };
  const teams = await listTeams(session.code);
  await Promise.all(teams.map((t) => saveTeam(t.id, syncToPhase(t.state, next))));
  await writeAudit(session.code, null, sprint, phase, "phase", { op });

  return NextResponse.json({ ok: true, sprint, phase, finished });
}
