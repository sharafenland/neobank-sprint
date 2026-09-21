/**
 * Server-side game engine. Every dice roll and every state change happens
 * here, never on a player's device — a group cannot reroll by reloading.
 */
import { FEATURE_BY_ID, INCIDENT_BY_ID, PHASES, PRACTICE_BY_ID } from "./cards";
import { eventIdFor, incidentIdFor, marketFor } from "./derive";
import { EVENT_FX, INCIDENT_FX, bug, cust, finding, log, type Fx } from "./effects";
import {
  capacity, devBonus, devTarget, has, mitBonus, own, relBonus, relTarget, releasing, resetSprint, usedSlots,
} from "./rules";
import type { SessionRow, TeamState } from "./types";

export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const d20 = () => 1 + Math.floor(Math.random() * 20);

export interface RosterEntry {
  name: string;
  customers: number;
  bugs: number;
}

/**
 * Brings a team's state up to the session's current phase. Idempotent: each
 * phase's entry effects carry a marker, so a device that polls twice or joins
 * late lands in exactly the same place.
 */
export function syncToPhase(t: TeamState, session: SessionRow): TeamState {
  const { sprint } = session;

  const resetKey = `reset:${sprint}`;
  if (sprint > 1 && !t.applied[resetKey]) {
    resetSprint(t);
    t.applied[resetKey] = true;
  }

  for (let phase = 0; phase <= session.phase; phase++) {
    const key = `${sprint}:${phase}`;
    if (t.applied[key]) continue;
    const fx: Fx = { t, sprint };
    const id = PHASES[phase].id;

    if (id === "incident") {
      const cardId = incidentIdFor(session.seed, sprint);
      const spec = INCIDENT_FX[cardId];
      const skip = spec.only ? !spec.only(t) : false;
      const auto = !skip && (spec.auto ? spec.auto(t) : false);
      const card = { skip, auto, rolled: false, done: skip || auto };
      if (auto) log(fx, "Incident avoided", "up");
      const needsNoRoll = !skip && !auto && INCIDENT_BY_ID[cardId].mit === null;
      if (needsNoRoll) {
        spec.fail(fx);
        card.done = true;
      }
      t.inc = card;
    }

    if (id === "release") {
      const list = releasing(t);
      const blocked = t.blockRelease || t.bugs >= 5;
      t.rel = { blocked, rolled: false, done: blocked || list.length === 0 };
      if (t.rel.done) settleShelved(fx);
    }

    if (id === "retro") {
      const gain = 2 - t.ipPenalty;
      t.ip += gain;
      log(fx, `${gain >= 0 ? "+" : ""}${gain} IP`, gain > 0 ? "up" : "down");
      if (own(t, "tests") && t.bugs > 0) bug(fx, -1);
      if (own(t, "compdes") && t.findings > 0) finding(fx, -1);
    }

    t.applied[key] = true;
  }
  return t;
}

function settleShelved(fx: Fx) {
  if (!own(fx.t, "flags")) return;
  for (const b of fx.t.built.filter((x) => x.shelved)) {
    const v = Math.round(FEATURE_BY_ID[b.id].k * 0.2);
    if (v > 0) {
      cust(fx, v);
      log(fx, `Feature-flag revenue from ${FEATURE_BY_ID[b.id].n}`);
    }
  }
}

export type Action =
  | { kind: "pick"; feature: string }
  | { kind: "commit" }
  | { kind: "unlock" }
  | { kind: "rollDev" }
  | { kind: "decide"; feature: string; how: "push" | "shelve" }
  | { kind: "rollIncident" }
  | { kind: "rollRelease" }
  | { kind: "resolveEvent" }
  | { kind: "buy"; practice: string };

function requirePhase(session: SessionRow, id: string) {
  if (PHASES[session.phase].id !== id) {
    throw new GameError(`That belongs to the ${id} phase — the room is in ${PHASES[session.phase].n}.`, 409);
  }
}

export function applyAction(
  t: TeamState,
  session: SessionRow,
  roster: RosterEntry[],
  action: Action,
): TeamState {
  const fx: Fx = { t, sprint: session.sprint };

  switch (action.kind) {
    case "pick": {
      requirePhase(session, "planning");
      if (t.confirmed) throw new GameError("Your plan is committed. Reopen it first.");
      const f = FEATURE_BY_ID[action.feature];
      if (!f) throw new GameError("No such feature.");
      if (!marketFor(session.seed, session.sprint).includes(f.id)) {
        throw new GameError("That card is not on the table this sprint.");
      }
      const at = t.picked.indexOf(f.id);
      if (at >= 0) t.picked.splice(at, 1);
      else if (usedSlots(t) + f.s <= capacity(t)) t.picked.push(f.id);
      else throw new GameError("Not enough slots left for that card.");
      return t;
    }

    case "commit": {
      requirePhase(session, "planning");
      // An empty plan is a legal move: a group may spend a sprint paying down
      // debt instead of taking new work, and a capped group may have nothing
      // on the table it can afford.
      t.confirmed = true;
      return t;
    }

    case "unlock": {
      requirePhase(session, "planning");
      t.confirmed = false;
      return t;
    }

    case "rollDev": {
      requirePhase(session, "dev");
      if (t.dev) throw new GameError("You have already rolled this sprint.", 409);
      if (!t.picked.length) throw new GameError("You committed nothing — there is nothing to roll.");
      const roll = d20();
      const total = roll + devBonus(t);
      const target = devTarget(t);
      const pass = total >= target;
      t.dev = { roll, total, target, pass, decided: {} };
      if (pass) {
        t.built = t.picked.map((id) => ({ id, buggy: false, shelved: false }));
        for (const id of t.picked) if (!has(t, id)) t.portfolio.push(id);
        log(fx, `Built ${t.picked.length} feature${t.picked.length === 1 ? "" : "s"} (${total} vs ${target})`, "up");
      } else {
        log(fx, `Development missed (${total} vs ${target})`, "down");
      }
      return t;
    }

    case "decide": {
      requirePhase(session, "dev");
      if (!t.dev || t.dev.pass) throw new GameError("Nothing to decide.");
      if (t.dev.decided[action.feature]) throw new GameError("Already decided.", 409);
      if (!t.picked.includes(action.feature)) throw new GameError("That card is not in your plan.");
      t.dev.decided[action.feature] = action.how;
      const f = FEATURE_BY_ID[action.feature];
      if (action.how === "push") {
        const clean = own(t, "dod");
        t.built.push({ id: f.id, buggy: !clean, shelved: false });
        if (!has(t, f.id)) t.portfolio.push(f.id);
        if (!clean) bug(fx, own(t, "agentic") ? 2 : 1);
        log(fx, `Pushed through: ${f.n}`, clean ? "" : "down");
      } else {
        t.built.push({ id: f.id, buggy: false, shelved: true });
        log(fx, `Shelved: ${f.n}`);
      }
      return t;
    }

    case "rollIncident": {
      requirePhase(session, "incident");
      const cardId = incidentIdFor(session.seed, session.sprint);
      const card = INCIDENT_BY_ID[cardId];
      const spec = INCIDENT_FX[cardId];
      if (!t.inc || t.inc.done) throw new GameError("This incident is already settled for you.", 409);
      if (card.mit === null) throw new GameError("This card is not rolled against.");
      const mod = spec.mod ? spec.mod(t) : 0;
      const roll = d20();
      const total = roll + mitBonus(t) + mod;
      const pass = total >= card.mit;
      t.inc = { ...t.inc, rolled: true, roll, total, pass, done: true };
      log(fx, `${pass ? "Mitigated" : "Hit by"} ${card.n} (${total} vs ${card.mit})`, pass ? "up" : "down");
      if (pass) spec.pass?.(fx);
      else spec.fail(fx);
      return t;
    }

    case "rollRelease": {
      requirePhase(session, "release");
      if (!t.rel || t.rel.done) throw new GameError("Your release is already settled.", 409);
      const list = releasing(t);
      const roll = d20();
      const total = roll + relBonus(t);
      const target = relTarget(t);
      const full = total >= target;
      t.rel = { ...t.rel, rolled: true, roll, total, target, full, done: true };
      const gained = list.reduce((a, b) => a + (full ? FEATURE_BY_ID[b.id].k : Math.round(FEATURE_BY_ID[b.id].k * 0.25)), 0);
      cust(fx, gained);
      t.shipped += list.length;
      log(fx, full ? "Full release" : "Soft launch at 25%", full ? "up" : "down");
      settleShelved(fx);
      return t;
    }

    case "resolveEvent": {
      requirePhase(session, "market");
      if (t.eventResolved) throw new GameError("Already resolved.", 409);
      const eventId = eventIdFor(session.seed, session.sprint);
      const best = Math.max(...roster.map((r) => r.customers), 0);
      const fewest = Math.min(...roster.map((r) => r.bugs), Number.MAX_SAFE_INTEGER);
      const outcome = EVENT_FX[eventId](t, {
        isLeader: t.customers === best && best > 0,
        hasFewestBugs: t.bugs === fewest,
      });
      if (outcome.d) cust(fx, outcome.d);
      if (outcome.f) finding(fx, outcome.f);
      if (outcome.ip) {
        t.ip += outcome.ip;
        log(fx, `+${outcome.ip} IP`, "up");
      }
      t.eventResolved = { d: outcome.d, f: outcome.f ?? 0, w: outcome.w };
      return t;
    }

    case "buy": {
      requirePhase(session, "retro");
      const p = PRACTICE_BY_ID[action.practice];
      if (!p) throw new GameError("No such practice.");
      if (own(t, p.id)) throw new GameError("You already have that.", 409);
      if (t.ip < p.ip) throw new GameError("Not enough Investment Points.");
      t.ip -= p.ip;
      t.ipSpent += p.ip;
      t.practices.push(p.id);
      log(fx, `Adopted ${p.n}`, "up");
      return t;
    }
  }
}

/** Has this group finished what the current phase asks of it? */
export function phaseDone(t: TeamState, session: SessionRow): boolean {
  switch (PHASES[session.phase].id) {
    case "planning": return t.confirmed;
    case "dev": return t.picked.length === 0 || (!!t.dev && (t.dev.pass || t.picked.every((id) => t.dev!.decided[id])));
    case "incident": return !!t.inc?.done;
    case "release": return !!t.rel?.done;
    case "market": return !!t.eventResolved;
    case "retro": return true;
  }
}
