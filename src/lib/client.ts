"use client";

import type { GameView } from "./types";

export type View = GameView & { isHost: boolean };

const KEY = {
  host: (code: string) => `nbs.host.${code}`,
  team: (code: string) => `nbs.team.${code}`,
};

export function readToken(kind: "host" | "team", code: string): string | null {
  try { return localStorage.getItem(KEY[kind](code)); } catch { return null; }
}
export function writeToken(kind: "host" | "team", code: string, token: string) {
  try { localStorage.setItem(KEY[kind](code), token); } catch { /* private mode */ }
}

function authHeaders(code: string): HeadersInit {
  const h: Record<string, string> = { "content-type": "application/json" };
  const host = readToken("host", code);
  const team = readToken("team", code);
  if (host) h["x-host-token"] = host;
  if (team) h["x-team-token"] = team;
  return h;
}

async function parse(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

export async function fetchView(code: string): Promise<View> {
  return parse(await fetch(`/api/sessions/${code}`, { headers: authHeaders(code), cache: "no-store" }));
}
export async function createSession(sprints: number): Promise<{ code: string; hostToken: string }> {
  return parse(await fetch(`/api/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sprints }) }));
}
export async function joinSession(code: string, name: string): Promise<{ token: string; name: string }> {
  return parse(await fetch(`/api/sessions/${code}/teams`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }));
}
export type HostOp = "next" | "back" | "revealIncident" | "revealEvent" | "finish" | "extend";

export async function hostOp(code: string, op: HostOp) {
  return parse(await fetch(`/api/sessions/${code}/phase`, { method: "POST", headers: authHeaders(code), body: JSON.stringify({ op }) }));
}
export async function act(code: string, action: unknown) {
  return parse(await fetch(`/api/sessions/${code}/actions`, { method: "POST", headers: authHeaders(code), body: JSON.stringify(action) }));
}
