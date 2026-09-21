/** Pure derivations over a team's state. Shared by the server and the UI. */
import { FEATURE_BY_ID } from "./cards";
import type { TeamState } from "./types";

export const has = (t: TeamState, featureId: string) => t.portfolio.includes(featureId);
export const own = (t: TeamState, practiceId: string) => t.practices.includes(practiceId);

export function capacity(t: TeamState): number {
  return Math.max(1, 2 + (own(t, "crossfn") ? 1 : 0) - (t.findings >= 3 ? 1 : 0));
}

export function usedSlots(t: TeamState): number {
  return t.picked.reduce((a, id) => a + FEATURE_BY_ID[id].s, 0);
}

/**
 * Platform cards in the portfolio pay a permanent modifier instead of
 * customers. Capped per category so a group cannot buy its way out of the
 * dice entirely — past four, more infrastructure stops helping the roll.
 */
export const INFRA_CAP = 4;

export function infraBonus(t: TeamState): { dev: number; rel: number; mit: number } {
  let dev = 0, rel = 0, mit = 0;
  for (const id of t.portfolio) {
    const b = FEATURE_BY_ID[id]?.bonus;
    if (!b) continue;
    dev += b.dev ?? 0;
    rel += b.rel ?? 0;
    mit += b.mit ?? 0;
  }
  return {
    dev: Math.min(dev, INFRA_CAP),
    rel: Math.min(rel, INFRA_CAP),
    mit: Math.min(mit, INFRA_CAP),
  };
}

export function devBonus(t: TeamState): number {
  return 2 + (own(t, "pair") ? 2 : 0) + (own(t, "agentic") ? 3 : 0) + (own(t, "retro") ? 1 : 0)
    + infraBonus(t).dev + t.devMod;
}

export function mitBonus(t: TeamState): number {
  return 2 + (own(t, "blameless") ? 3 : 0) + (own(t, "sre") ? 2 : 0) + (own(t, "retro") ? 1 : 0)
    + infraBonus(t).mit - t.findings;
}

export const DRAG_CAP = 6;

/**
 * Legacy drag: product features piled on a thin platform make everything
 * afterwards harder to build. One platform card carries two product features;
 * every product feature past that adds +1 to the combined Development target.
 * This is the architectural half of technical debt — the bug counter only
 * models the unfinished-work half, so without this a group that never builds
 * infrastructure would pay nothing for it.
 */
export function legacyDrag(t: TeamState): number {
  let platform = 0;
  for (const id of t.portfolio) if (FEATURE_BY_ID[id]?.c === "platform") platform++;
  const product = t.portfolio.length - platform;
  return Math.min(DRAG_CAP, Math.max(0, Math.floor(product / 2) - platform));
}

export function devTarget(t: TeamState): number {
  const raw = t.picked.reduce((a, id) => a + FEATURE_BY_ID[id].t, 0);
  const modular = own(t, "modular") && t.picked.length >= 2 ? 3 : 0;
  return Math.max(1, raw + legacyDrag(t) - modular);
}

export const releasing = (t: TeamState) => t.built.filter((b) => !b.shelved);

export function relTarget(t: TeamState): number {
  return releasing(t).reduce((a, b) => a + FEATURE_BY_ID[b.id].r, 0);
}

export function relBonus(t: TeamState): number {
  const buggy = releasing(t).filter((b) => b.buggy).length;
  return 2 + (own(t, "cicd") ? 3 : 0) + (own(t, "retro") ? 1 : 0)
    + infraBonus(t).rel - t.bugs - 2 * buggy;
}

export function emptyTeamState(): TeamState {
  return {
    customers: 0, bugs: 0, findings: 0, ip: 0, ipSpent: 0, shipped: 0,
    practices: [], portfolio: [],
    picked: [], confirmed: false, dev: null, built: [], inc: null, rel: null, eventResolved: null,
    devMod: 0, blockRelease: false, ipPenalty: 0,
    applied: {}, feed: [],
  };
}

export function resetSprint(t: TeamState): void {
  t.picked = []; t.confirmed = false; t.dev = null; t.built = []; t.inc = null; t.rel = null;
  t.eventResolved = null; t.devMod = 0; t.blockRelease = false; t.ipPenalty = 0;
}
