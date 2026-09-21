import { NextResponse } from "next/server";
import { createSession } from "@/lib/store";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sprints = Number(body.sprints);
  if (![3, 4, 6, 8].includes(sprints)) {
    return NextResponse.json({ error: "Pick 3, 4, 6 or 8 sprints." }, { status: 400 });
  }
  const created = await createSession(sprints);
  return NextResponse.json(created, { status: 201 });
}
