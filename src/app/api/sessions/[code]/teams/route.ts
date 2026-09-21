import { NextResponse } from "next/server";
import { getSession, joinTeam, writeAudit } from "@/lib/store";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const session = await getSession(code.toUpperCase());
  if (!session) return NextResponse.json({ error: "No session with that code." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (name.length < 2 || name.length > 22) {
    return NextResponse.json({ error: "Group names are 2 to 22 characters." }, { status: 400 });
  }

  const { token, rejoined } = await joinTeam(session, name);
  if (!rejoined) await writeAudit(session.code, name, session.sprint, session.phase, "join", { name });
  return NextResponse.json({ token, name, rejoined }, { status: rejoined ? 200 : 201 });
}
