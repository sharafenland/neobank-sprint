import { NextResponse } from "next/server";
import { PHASES } from "@/lib/cards";
import { syncToPhase } from "@/lib/engine";
import { nextBotKind } from "@/lib/bots";
import {
  addBot, finishSession, getSession, isHost, listTeams, playBots, saveTeam, setPhase, setReveal, setSprints, setTeaching,
  writeAudit,
} from "@/lib/store";

/** More than this and the bots outnumber a small room. */
const MAX_BOTS = 3;

/** A session can be extended, but not without end. */
const MAX_SPRINTS = 12;

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
    // Bots play a card only once the room can see it.
    await playBots(op === "revealIncident" ? { ...session, reveal_incident: true } : { ...session, reveal_event: true });
    return NextResponse.json({ ok: true });
  }

  if (op === "addBot") {
    if (session.finished) return NextResponse.json({ error: "The session is over." }, { status: 409 });
    const teams = await listTeams(session.code);
    const bots = teams.filter((t) => t.state.bot);
    if (bots.length >= MAX_BOTS) {
      return NextResponse.json({ error: `${MAX_BOTS} bots is the most a room can take.` }, { status: 400 });
    }
    const name = await addBot(session, nextBotKind(bots.map((t) => t.state.bot)));
    await playBots(session);
    await writeAudit(session.code, name, session.sprint, session.phase, "addBot", { name });
    return NextResponse.json({ ok: true, name });
  }

  // Lecture notes can be switched at any point; nothing in the game depends on them.
  if (op === "showTeaching" || op === "hideTeaching") {
    await setTeaching(session.code, op === "showTeaching");
    return NextResponse.json({ ok: true, teaching: op === "showTeaching" });
  }

  // Stop after the sprint in progress, whatever the plan said.
  if (op === "finish") {
    await finishSession(session.code);
    await writeAudit(session.code, null, session.sprint, session.phase, "finish", { after: session.sprint });
    return NextResponse.json({ ok: true, finished: true });
  }

  // Room still has energy at the last retro? Give it one more sprint.
  if (op === "extend") {
    if (session.sprints >= MAX_SPRINTS) {
      return NextResponse.json({ error: `${MAX_SPRINTS} sprints is as far as this goes.` }, { status: 400 });
    }
    await setSprints(session.code, session.sprints + 1);
    await writeAudit(session.code, null, session.sprint, session.phase, "extend", { sprints: session.sprints + 1 });
    return NextResponse.json({ ok: true, sprints: session.sprints + 1 });
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

  await setPhase(session.code, sprint, phase, finished, session.solo);

  // Apply whatever the new phase does to each group, once.
  const next = {
    ...session, sprint, phase, finished,
    reveal_incident: session.solo, reveal_event: session.solo,
  };
  const teams = await listTeams(session.code);
  await Promise.all(teams.map((t) => saveTeam(t.id, syncToPhase(t.state, next))));
  await playBots(next);
  await writeAudit(session.code, null, sprint, phase, "phase", { op });

  return NextResponse.json({ ok: true, sprint, phase, finished });
}
