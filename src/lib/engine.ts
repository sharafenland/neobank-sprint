/**
 * Server-side game engine. Every dice roll and every state change happens
 * here, never on a player's device — a group cannot reroll by reloading.
 */
import { FEATURE_BY_ID, INCIDENT_BY_ID, PHASES, PRACTICE_BY_ID } from "./cards";
import { eventIdFor, incidentIdFor, marketFor } from "./derive";
import { EVENT_FX, INCIDENT_FX, bug, cust, finding, incidentParts, log, type Fx } from "./effects";
import {
  DEFAULT_SLOTS, FIX_PER_SLOT, IP_BONUS_FROM_SPRINT, canAffordAny, capacity, cartCost, devParts, devTarget, has, maxFixSlots, mitParts, own,
  relParts, relTarget, releasing, resetSprint, sumParts, usedSlots,
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
  if (!t.fix) t.fix = { bugs: 0, findings: 0 };
  if (!t.shelf) t.shelf = [];
  t.slots = session.slots ?? DEFAULT_SLOTS;
  if (!t.retroCart) t.retroCart = [];
  if (!t.retroBought) t.retroBought = [];

  // A selection the group never confirmed still counts when the room moves
  // on, the same way an uncommitted plan does — points are not lost to a
  // missed click. This covers the last retro too, when the session finishes.
  if (session.finished && t.retroCart.length) adoptCart({ t, sprint });

  const resetKey = `reset:${sprint}`;
  if (sprint > 1 && !t.applied[resetKey]) {
    if (t.retroCart.length) adoptCart({ t, sprint: sprint - 1 });
    resetSprint(t);
    t.applied[resetKey] = true;
  }

  for (let phase = 0; phase <= session.phase; phase++) {
    const key = `${sprint}:${phase}`;
    if (t.applied[key]) continue;
    const fx: Fx = { t, sprint };
    const id = PHASES[phase].id;

    if (id === "dev") {
      // Remediation resolves before the release roll, which is the point: a
      // team at five bugs can spend a slot and ship again in the same sprint.
      if (t.fix.bugs > 0) bug(fx, -Math.min(t.bugs, t.fix.bugs * FIX_PER_SLOT.bugs));
      if (t.fix.findings > 0) finding(fx, -Math.min(t.findings, t.fix.findings * FIX_PER_SLOT.findings));
    }

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
      // One point for handling the sprint well — never two, however well.
      // Preparation counts: an incident a portfolio card removed outright is
      // handled just as much as one that was rolled against.
      const handled = !!t.inc && (t.inc.pass === true || t.inc.auto === true);
      const clean = t.bugs === 0;
      const earned = sprint >= IP_BONUS_FROM_SPRINT && (handled || clean);
      const base = 2 - t.ipPenalty;
      const bonus = earned ? 1 : 0;
      const reason = !earned
        ? sprint < IP_BONUS_FROM_SPRINT
          ? `no bonus before sprint ${IP_BONUS_FROM_SPRINT}`
          : "the incident hit you and you are carrying bugs"
        : handled
          ? "the incident was handled"
          : "you ended the sprint with no bugs";

      t.retroPay = { base, bonus, reason };
      t.ip += base + bonus;
      log(fx, `${base + bonus >= 0 ? "+" : ""}${base + bonus} IP${bonus ? " — " + reason : ""}`, base + bonus > 0 ? "up" : "down");
      if (own(t, "tests") && t.bugs > 0) bug(fx, -1);
      if (own(t, "compdes") && t.findings > 0) finding(fx, -1);
    }

    t.applied[key] = true;
  }
  return t;
}

/** Pays for everything selected at the retro. */
function adoptCart(fx: Fx) {
  const { t } = fx;
  for (const id of t.retroCart) {
    const p = PRACTICE_BY_ID[id];
    if (!p || own(t, id) || t.ip < p.ip) continue;
    t.ip -= p.ip;
    t.ipSpent += p.ip;
    t.practices.push(id);
    t.retroBought.push(id);
    log(fx, `Adopted ${p.n}`, "up");
  }
  t.retroCart = [];
}

const unshelve = (t: TeamState, id: string) => { t.shelf = t.shelf.filter((x) => x !== id); };

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
  | { kind: "fix"; what: "bugs" | "findings"; delta: 1 | -1 }
  | { kind: "commit" }
  | { kind: "unlock" }
  | { kind: "rollDev" }
  | { kind: "decide"; feature: string; how: "push" | "shelve" }
  | { kind: "rollIncident" }
  | { kind: "rollRelease" }
  | { kind: "resolveEvent" }
  | { kind: "buy"; practice: string }
  | { kind: "confirmRetro" }
  | { kind: "reopenRetro" };

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
      // The shelf is open whatever the table shows: rotating off must not
      // throw away work a group chose to keep.
      if (!marketFor(session.seed, session.sprint).includes(f.id) && !t.shelf.includes(f.id)) {
        throw new GameError("That card is neither on the table this sprint nor on your shelf.");
      }
      const at = t.picked.indexOf(f.id);
      if (at >= 0) t.picked.splice(at, 1);
      else if (usedSlots(t) + f.s <= capacity(t)) t.picked.push(f.id);
      else throw new GameError("Not enough slots left for that card.");
      return t;
    }

    case "fix": {
      requirePhase(session, "planning");
      if (t.confirmed) throw new GameError("Your plan is committed. Reopen it first.");
      const current = t.fix[action.what];
      if (action.delta < 0) {
        if (current === 0) throw new GameError("Nothing to take back.");
        t.fix[action.what] = current - 1;
        return t;
      }
      if (usedSlots(t) + 1 > capacity(t)) throw new GameError("No slots left this sprint.");
      if (current + 1 > maxFixSlots(t)[action.what]) {
        throw new GameError(`One more slot would not clear anything — you have ${t[action.what]}.`);
      }
      t.fix[action.what] = current + 1;
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
      const parts = devParts(t);
      const total = roll + sumParts(parts);
      const target = devTarget(t);
      const pass = total >= target;
      t.dev = { roll, total, target, pass, parts, decided: {} };
      if (pass) {
        t.built = t.picked.map((id) => ({ id, buggy: false, shelved: false }));
        for (const id of t.picked) {
          if (!has(t, id)) t.portfolio.push(id);
          unshelve(t, id);
        }
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
        unshelve(t, f.id);
        if (!clean) bug(fx, own(t, "agentic") ? 2 : 1);
        log(fx, `Pushed through: ${f.n}`, clean ? "" : "down");
      } else {
        t.built.push({ id: f.id, buggy: false, shelved: true });
        if (!t.shelf.includes(f.id)) t.shelf.push(f.id);
        log(fx, `Shelved: ${f.n} — on your shelf at half its Dev target`);
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
      const parts = [...mitParts(t), ...incidentParts(spec, t)];
      const roll = d20();
      const total = roll + sumParts(parts);
      const pass = total >= card.mit;
      t.inc = { ...t.inc, rolled: true, roll, total, pass, parts, done: true };
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
      const parts = relParts(t);
      const total = roll + sumParts(parts);
      const target = relTarget(t);
      const full = total >= target;
      t.rel = { ...t.rel, rolled: true, roll, total, target, full, parts, done: true };
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

    // Selecting is free to change; nothing is paid until the group confirms.
    case "buy": {
      requirePhase(session, "retro");
      if (t.retroDone) throw new GameError("Your purchases are confirmed. Reopen them first.");
      const p = PRACTICE_BY_ID[action.practice];
      if (!p) throw new GameError("No such practice.");
      if (own(t, p.id)) throw new GameError("You already have that.", 409);
      const at = t.retroCart.indexOf(p.id);
      if (at >= 0) t.retroCart.splice(at, 1);
      else if (cartCost(t) + p.ip <= t.ip) t.retroCart.push(p.id);
      else throw new GameError("Not enough Investment Points.");
      return t;
    }

    case "confirmRetro": {
      requirePhase(session, "retro");
      if (t.retroDone) throw new GameError("Already confirmed.", 409);
      adoptCart(fx);
      t.retroDone = true;
      return t;
    }

    // Practices only act from the next sprint on, so taking one back before
    // then changes nothing that has already been rolled.
    case "reopenRetro": {
      requirePhase(session, "retro");
      if (!t.retroDone) throw new GameError("Nothing confirmed to reopen.", 409);
      for (const id of t.retroBought) {
        const p = PRACTICE_BY_ID[id];
        t.practices = t.practices.filter((x) => x !== id);
        t.ip += p.ip;
        t.ipSpent -= p.ip;
        log(fx, `Took back ${p.n}`);
      }
      t.retroCart = t.retroBought;
      t.retroBought = [];
      t.retroDone = false;
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
    // Done when the group says so, or when there is nothing left it could
    // buy — a group with no points should not have to click to be counted.
    case "retro": return !!t.retroDone || (!canAffordAny(t) && !(t.retroCart ?? []).length);
  }
}
