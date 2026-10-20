import { NextResponse } from "next/server";
import { DEFAULT_SLOTS, SLOT_CHOICES } from "@/lib/rules";
import { createSession } from "@/lib/store";

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
  const created = await createSession(sprints, slots);
  return NextResponse.json(created, { status: 201 });
}
