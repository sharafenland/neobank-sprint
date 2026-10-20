/** Pure derivations over a team's state. Shared by the server and the UI. */
import { FEATURE_BY_ID, PRACTICES } from "./cards";
import type { BonusPart, TeamState } from "./types";

export const has = (t: TeamState, featureId: string) => t.portfolio.includes(featureId);
export const own = (t: TeamState, practiceId: string) => t.practices.includes(practiceId);

/** Base capacity the facilitator can choose, and the one a session gets by default. */
export const SLOT_CHOICES = [1, 2, 3, 4] as const;
export const DEFAULT_SLOTS = 2;

export function capacity(t: TeamState): number {
  const base = t.slots ?? DEFAULT_SLOTS;
  return Math.max(1, base + (own(t, "crossfn") ? 1 : 0) - (t.findings >= 3 ? 1 : 0));
}

/**
 * Investment points do not accumulate: whatever is not spent at the retro is
 * gone when the next sprint starts. Every retro is therefore a decision rather
 * than a savings account, and the three-point practices are only reachable in
 * a sprint that earned the bonus.
 */
export const IP_BONUS_FROM_SPRINT = 3;

/** A slot of remediation clears this much. */
export const FIX_PER_SLOT = { bugs: 2, findings: 1 };

export function fixSlots(t: TeamState): number {
  return (t.fix?.bugs ?? 0) + (t.fix?.findings ?? 0);
}

/** The most remediation worth buying — never more slots than there is debt. */
export function maxFixSlots(t: TeamState) {
  return {
    bugs: Math.ceil(t.bugs / FIX_PER_SLOT.bugs),
    findings: Math.ceil(t.findings / FIX_PER_SLOT.findings),
  };
}

export function usedSlots(t: TeamState): number {
  return t.picked.reduce((a, id) => a + FEATURE_BY_ID[id].s, 0) + fixSlots(t);
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

/**
 * Each roll's modifier as a list of reasons, so the screen can say where every
 * point comes from. The bonus functions are the sums of these and nothing else,
 * which keeps the explanation and the arithmetic from drifting apart.
 */
const BASE: BonusPart = { label: "Base", value: 2 };

const practicePart = (t: TeamState, id: string, label: string, value: number): BonusPart[] =>
  own(t, id) ? [{ label, value }] : [];

/** One line for the whole infrastructure bonus, naming the cards behind it. */
function infraPart(t: TeamState, key: "dev" | "rel" | "mit"): BonusPart[] {
  const cards = t.portfolio
    .map((id) => FEATURE_BY_ID[id])
    .filter((f) => f?.bonus?.[key])
    .map((f) => `${f.n} +${f.bonus![key]}`);
  const value = infraBonus(t)[key];
  if (!value) return [];
  const raw = t.portfolio.reduce((a, id) => a + (FEATURE_BY_ID[id]?.bonus?.[key] ?? 0), 0);
  return [{ label: `Infrastructure (${cards.join(", ")}${raw > value ? `, capped at +${INFRA_CAP}` : ""})`, value }];
}

export const sumParts = (parts: BonusPart[]) => parts.reduce((a, p) => a + p.value, 0);

export function devParts(t: TeamState): BonusPart[] {
  return [
    BASE,
    ...practicePart(t, "pair", "Pair Programming", 2),
    ...practicePart(t, "agentic", "Agentic Coding", 3),
    ...practicePart(t, "retro", "Retro Culture", 1),
    ...infraPart(t, "dev"),
    // Only the Lead Engineer Resigns incident sets this today.
    ...(t.devMod ? [{ label: "Lead engineer resigned", value: t.devMod }] : []),
  ];
}

export function mitParts(t: TeamState): BonusPart[] {
  return [
    BASE,
    ...practicePart(t, "blameless", "Blameless Postmortems", 3),
    ...practicePart(t, "sre", "Observability & SRE", 2),
    ...practicePart(t, "retro", "Retro Culture", 1),
    ...infraPart(t, "mit"),
    ...(t.findings ? [{ label: `Open audit findings (${t.findings})`, value: -t.findings }] : []),
  ];
}

export const devBonus = (t: TeamState) => sumParts(devParts(t));
export const mitBonus = (t: TeamState) => sumParts(mitParts(t));

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

export const onShelf = (t: TeamState, featureId: string) => (t.shelf ?? []).includes(featureId);

/**
 * Shelved work is not lost: the half that was done stays done. A card picked
 * from the shelf counts half its Development target, rounded up — once, not
 * again for every time it is shelved.
 */
export const shelvedTarget = (featureId: string) => Math.ceil(FEATURE_BY_ID[featureId].t / 2);

export function cardDevTarget(t: TeamState, featureId: string): number {
  return onShelf(t, featureId) ? shelvedTarget(featureId) : FEATURE_BY_ID[featureId].t;
}

export function devTarget(t: TeamState): number {
  const raw = t.picked.reduce((a, id) => a + cardDevTarget(t, id), 0);
  const modular = own(t, "modular") && t.picked.length >= 2 ? 3 : 0;
  return Math.max(1, raw + legacyDrag(t) - modular);
}

export const releasing = (t: TeamState) => t.built.filter((b) => !b.shelved);

export function relTarget(t: TeamState): number {
  return releasing(t).reduce((a, b) => a + FEATURE_BY_ID[b.id].r, 0);
}

export function relParts(t: TeamState): BonusPart[] {
  const buggy = releasing(t).filter((b) => b.buggy).length;
  return [
    BASE,
    ...practicePart(t, "cicd", "CI/CD Pipeline", 3),
    ...practicePart(t, "retro", "Retro Culture", 1),
    ...infraPart(t, "rel"),
    ...(t.bugs ? [{ label: `Open bugs (${t.bugs})`, value: -t.bugs }] : []),
    ...(buggy ? [{ label: `Pushed-through features in this release (${buggy} × 2)`, value: -2 * buggy }] : []),
  ];
}

export const relBonus = (t: TeamState) => sumParts(relParts(t));

/** What the practices selected at this retro would cost. */
export function cartCost(t: TeamState): number {
  return (t.retroCart ?? []).reduce((a, id) => a + (PRACTICES.find((p) => p.id === id)?.ip ?? 0), 0);
}

/** Is there anything left in the shop this group could still add to its selection? */
export function canAffordAny(t: TeamState): boolean {
  const left = t.ip - cartCost(t);
  const cart = t.retroCart ?? [];
  return PRACTICES.some((p) => !own(t, p.id) && !cart.includes(p.id) && left >= p.ip);
}

/** Average raw d20, one decimal; null until something has been rolled. */
export function avgRoll(t: TeamState): number | null {
  const r = t.rolls ?? [];
  return r.length ? Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10 : null;
}

export function emptyTeamState(): TeamState {
  return {
    customers: 0, bugs: 0, findings: 0, ip: 0, ipSpent: 0, slots: DEFAULT_SLOTS, shipped: 0, rolls: [],
    practices: [], portfolio: [], shelf: [],
    picked: [], fix: { bugs: 0, findings: 0 },
    confirmed: false, dev: null, built: [], inc: null, rel: null, eventResolved: null,
    devMod: 0, blockRelease: false, ipPenalty: 0, retroPay: null,
    retroCart: [], retroBought: [], retroDone: false,
    applied: {}, feed: [],
  };
}

export function resetSprint(t: TeamState): void {
  t.picked = []; t.fix = { bugs: 0, findings: 0 };
  t.confirmed = false; t.dev = null; t.built = []; t.inc = null; t.rel = null;
  t.eventResolved = null; t.devMod = 0; t.blockRelease = false; t.ipPenalty = 0;
  t.retroPay = null; t.retroCart = []; t.retroBought = []; t.retroDone = false;
  t.ip = 0; // unspent points expire with the sprint
}
