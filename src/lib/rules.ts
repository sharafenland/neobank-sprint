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

export function devBonus(t: TeamState): number {
  return 2 + (own(t, "pair") ? 2 : 0) + (own(t, "agentic") ? 3 : 0) + (own(t, "retro") ? 1 : 0) + t.devMod;
}

export function mitBonus(t: TeamState): number {
  return 2 + (own(t, "blameless") ? 3 : 0) + (own(t, "sre") ? 2 : 0) + (own(t, "retro") ? 1 : 0) - t.findings;
}

export function devTarget(t: TeamState): number {
  const raw = t.picked.reduce((a, id) => a + FEATURE_BY_ID[id].t, 0);
  return Math.max(1, raw - (own(t, "modular") && t.picked.length >= 2 ? 3 : 0));
}

export const releasing = (t: TeamState) => t.built.filter((b) => !b.shelved);

export function relTarget(t: TeamState): number {
  return releasing(t).reduce((a, b) => a + FEATURE_BY_ID[b.id].r, 0);
}

export function relBonus(t: TeamState): number {
  const buggy = releasing(t).filter((b) => b.buggy).length;
  return 2 + (own(t, "cicd") ? 3 : 0) + (own(t, "retro") ? 1 : 0) - t.bugs - 2 * buggy;
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
