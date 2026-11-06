import { NextResponse } from "next/server";
import { BOT_KINDS } from "@/lib/bots";
import { DEFAULT_SLOTS, SLOT_CHOICES } from "@/lib/rules";
import { addBot, createSession, getSession, joinTeam, playBots } from "@/lib/store";

const MAX_BOTS = BOT_KINDS.length;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sprints = Number(body.sprints);
  if (![3, 4, 6, 8].includes(sprints)) {
    return NextResponse.json({ error: "Pick 3, 4, 6 or 8 sprints." }, { status: 400 });
  }
  const slots = body.slots === undefined ? DEFAULT_SLOTS : Number(body.slots);
  if (!(SLOT_CHOICES as readonly number[]).includes(slots)) {
    return NextResponse.json({ error: `Pick ${SLOT_CHOICES.join(", ")} slots per sprint.` }, { status: 400 });
  }
  const bots = body.bots === undefined ? 0 : Number(body.bots);
  if (!Number.isInteger(bots) || bots < 0 || bots > MAX_BOTS) {
    return NextResponse.json({ error: `Pick 0 to ${MAX_BOTS} bots.` }, { status: 400 });
  }
  const solo = body.solo === true;
  const name = String(body.name ?? "").trim() || "Your bank";
  if (solo && (name.length < 2 || name.length > 22)) {
    return NextResponse.json({ error: "Bank names are 2 to 22 characters." }, { status: 400 });
  }

  // Lecture notes are opt-in: only an explicit true turns them on.
  const created = await createSession(sprints, slots, body.teaching === true, solo);
  const session = (await getSession(created.code))!;

  // A solo player is the host and the only group at once; the device keeps both keys.
  const team = solo ? await joinTeam(session, name) : null;
  for (let i = 0; i < bots; i++) await addBot(session, BOT_KINDS[i]);
  if (bots) await playBots(session);

  return NextResponse.json({ ...created, ...(team ? { teamToken: team.token } : {}) }, { status: 201 });
}
