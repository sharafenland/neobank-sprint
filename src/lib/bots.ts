/**
 * Computer-controlled banks. A bot is an ordinary team whose state names a
 * strategy: it plays through the same engine, under the same rules and with
 * the same dice, so it can never do anything a group could not. All it adds is
 * a way to choose — deliberately simple, so a group that thinks will beat it.
 */
import { FEATURE_BY_ID, PHASES } from "./cards";
import { GameError, applyAction, phaseDone, syncToPhase, tableFor, type Action, type RosterEntry } from "./engine";
import { canPush, capacity, devBonus, devTarget, emptyTeamState, legacyDrag, own, settledPortfolio, usedSlots } from "./rules";
import type { BotKind, SessionRow, TeamState } from "./types";

export const BOT_KINDS: BotKind[] = ["growth", "balanced", "platform"];

export const BOTS: Record<BotKind, { name: string; blurb: string }> = {
  growth: { name: "Rocket Bank", blurb: "Chases customers and pushes unfinished work through." },
  balanced: { name: "Steady Bank", blurb: "One product and one platform card a sprint; pays debt down early." },
  platform: { name: "Bedrock Bank", blurb: "Builds the platform first and sells later." },
};

/**
 * How hard a plan a bot will take on: the highest die roll it is willing to
 * need. Fifteen means a 30% shot, eleven a 50% one.
 */
const NERVE: Record<BotKind, number> = { growth: 15, balanced: 12, platform: 13 };

/** Shopping lists, in order of preference. */
const SHOP: Record<BotKind, string[]> = {
  growth: ["crossfn", "pair", "cicd", "agentic", "flags", "retro", "tests", "blameless", "modular", "sre", "dod", "compdes"],
  balanced: ["cicd", "tests", "crossfn", "pair", "blameless", "compdes", "dod", "modular", "sre", "retro", "flags", "agentic"],
  platform: ["tests", "cicd", "crossfn", "blameless", "dod", "compdes", "pair", "sre", "modular", "retro", "flags", "agentic"],
};

const isPlatform = (id: string) => FEATURE_BY_ID[id].c === "platform";
const infraValue = (id: string) => {
  const b = FEATURE_BY_ID[id].bonus;
  return b ? (b.dev ?? 0) + (b.rel ?? 0) + (b.mit ?? 0) : 0;
};

/** Order in which a bot would like the cards it can see this sprint. */
function wishlist(kind: BotKind, t: TeamState, offered: string[], sprint: number): string[] {
  const product = offered.filter((id) => !isPlatform(id)).sort((a, b) => FEATURE_BY_ID[b].k - FEATURE_BY_ID[a].k);
  const platform = offered.filter(isPlatform).sort((a, b) => infraValue(b) - infraValue(a) || FEATURE_BY_ID[a].t - FEATURE_BY_ID[b].t);
  if (kind === "growth") return [...product, ...platform];
  // The platform bot lays a foundation first, and tops it up whenever legacy drag appears.
  if (kind === "platform" && (sprint === 1 || legacyDrag(t) > 0)) return [...platform, ...product];
  // Balanced, and the platform bot while its base holds: one of each, product first.
  const out: string[] = [];
  for (let i = 0; i < Math.max(product.length, platform.length); i++) {
    if (product[i]) out.push(product[i]);
    if (platform[i]) out.push(platform[i]);
  }
  return out;
}

function plan(kind: BotKind, t: TeamState, session: SessionRow, roster: RosterEntry[], act: (a: Action) => boolean) {
  // Debt first: past a point, no feature is worth a release that cannot ship.
  const bugLimit = kind === "growth" ? 5 : 3;
  while (t.bugs - t.fix.bugs * 2 >= bugLimit && act({ kind: "fix", what: "bugs", delta: 1 })) { /* keep fixing */ }
  if (t.findings >= 3) act({ kind: "fix", what: "findings", delta: 1 });

  const offered = [...new Set([...tableFor(session, roster), ...(t.shelf ?? [])])]
    .filter((id) => !t.portfolio.includes(id));
  for (const id of wishlist(kind, t, offered, session.sprint)) {
    if (usedSlots(t) + FEATURE_BY_ID[id].s > capacity(t)) continue;
    if (!act({ kind: "pick", feature: id })) continue;
    // Too ambitious for this bot's nerve? Put it back.
    if (devTarget(t) - devBonus(t) > NERVE[kind]) act({ kind: "pick", feature: id });
  }
  act({ kind: "commit" });
}

function decide(kind: BotKind, t: TeamState, act: (a: Action) => boolean) {
  for (const id of t.picked) {
    if (t.dev?.decided[id]) continue;
    const free = own(t, "dod");
    const push = canPush(t) && (free
      || kind === "growth"
      || (kind === "balanced" && !isPlatform(id) && t.bugs < 2));
    act({ kind: "decide", feature: id, how: push ? "push" : "shelve" });
  }
}

function shop(kind: BotKind, t: TeamState, act: (a: Action) => boolean) {
  for (const id of SHOP[kind]) {
    if (own(t, id) || (t.retroCart ?? []).includes(id)) continue;
    if (id === "compdes" && t.findings === 0) continue;
    act({ kind: "buy", practice: id });
  }
  act({ kind: "confirmRetro" });
}

/**
 * Plays whatever the current phase asks of a bot. Safe to call repeatedly:
 * every step is an engine action, and the engine refuses anything already done.
 * Incident and market cards are only played once the room can see them.
 */
export function botPlay(t: TeamState, session: SessionRow, roster: RosterEntry[]): TeamState {
  const kind = t.bot;
  if (!kind || session.finished) return t;
  syncToPhase(t, session);
  if (phaseDone(t, session)) return t;

  const act = (a: Action) => {
    try { applyAction(t, session, roster, a); return true; }
    catch (e) { if (e instanceof GameError) return false; throw e; }
  };

  switch (PHASES[session.phase].id) {
    case "planning": plan(kind, t, session, roster, act); break;
    case "dev":
      if (t.picked.length && !t.dev) act({ kind: "rollDev" });
      if (t.dev && !t.dev.pass) decide(kind, t, act);
      break;
    case "incident": if (session.reveal_incident) act({ kind: "rollIncident" }); break;
    case "release": act({ kind: "rollRelease" }); break;
    case "market": if (session.reveal_event) act({ kind: "resolveEvent" }); break;
    case "retro": shop(kind, t, act); break;
  }
  return t;
}

export function newBotState(kind: BotKind, session: SessionRow): TeamState {
  const t = emptyTeamState();
  t.bot = kind;
  return syncToPhase(t, session);
}

/** A bot kind the room has fewest of, so added bots differ from each other. */
export function nextBotKind(existing: (BotKind | undefined)[]): BotKind {
  const count = (k: BotKind) => existing.filter((e) => e === k).length;
  return [...BOT_KINDS].sort((a, b) => count(a) - count(b))[0];
}

/** Plays a whole game for one bot, alone. Used for the solo rating. */
export function simulateBot(kind: BotKind, seed: number, sprints: number, slots: number): number {
  const session: SessionRow = {
    code: "SIM", seed, sprints, slots, teaching: false, solo: true, sprint: 1, phase: 0,
    reveal_incident: true, reveal_event: true, finished: false,
  };
  const t = newBotState(kind, session);
  for (let sprint = 1; sprint <= sprints; sprint++) {
    for (let phase = 0; phase < PHASES.length; phase++) {
      session.sprint = sprint;
      session.phase = phase;
      botPlay(t, session, [{ name: "bot", customers: t.customers, bugs: t.bugs, owned: settledPortfolio(t) }]);
    }
  }
  return t.customers;
}

export interface Medals { bronze: number; silver: number; gold: number }

/**
 * What a solo game is measured against when there are no rivals: the spread
 * of results all three bots reach on random decks of the same length and
 * capacity. Bronze is a typical bot game, silver a good one, gold the top
 * tenth — beating a simple strategy that rolls the same dice.
 */
export function medals(sprints: number, slots: number, runs = 100): Medals {
  // The engine rolls with Math.random. Swapped for a seeded generator while
  // simulating, so every player of the same settings sees the same thresholds,
  // and a reload does not move them.
  const real = Math.random;
  let state = 0x2545f491 ^ (sprints * 977 + slots * 131);
  Math.random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const results: number[] = [];
  try {
    for (const kind of BOT_KINDS) {
      for (let i = 0; i < runs; i++) results.push(simulateBot(kind, 1 + i * 7919, sprints, slots));
    }
  } finally {
    Math.random = real;
  }
  results.sort((a, b) => a - b);
  const at = (q: number) => results[Math.min(results.length - 1, Math.floor(q * results.length))];
  return { bronze: at(0.5), silver: at(0.75), gold: at(0.9) };
}
