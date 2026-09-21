const { PHASES } = require("../.test-build/cards");
const { marketFor, incidentIdFor, eventIdFor } = require("../.test-build/derive");
const { syncToPhase, applyAction, phaseDone, GameError } = require("../.test-build/engine");
const { emptyTeamState, capacity, usedSlots } = require("../.test-build/rules");
const { FEATURE_BY_ID } = require("../.test-build/cards");

let failures = 0;
const check = (label, cond) => { if (!cond) { failures++; console.log("  FAIL:", label); } };

// --- determinism ---
check("same seed, same market", JSON.stringify(marketFor(12345, 3)) === JSON.stringify(marketFor(12345, 3)));
check("different seed, different market", JSON.stringify(marketFor(1, 1)) !== JSON.stringify(marketFor(2, 1)));
check("market is 6 cards", marketFor(999, 1).length === 6);
check("market rotates by one card per pile", marketFor(999, 1)[1] === marketFor(999, 2)[0]);
for (let s = 1; s <= 8; s++) {
  check("market has no duplicates in sprint " + s, new Set(marketFor(999, s)).size === 6);
}

// --- play three full games and make sure nothing throws or goes negative ---
function playGame(seed, sprints, strategy) {
  const session = { code: "TEST", seed, sprints, sprint: 1, phase: 0,
    reveal_incident: true, reveal_event: true, finished: false };
  const teams = [emptyTeamState(), emptyTeamState(), emptyTeamState()];
  const roster = () => teams.map((t, i) => ({ name: "G" + i, customers: t.customers, bugs: t.bugs }));

  for (let sprint = 1; sprint <= sprints; sprint++) {
    session.sprint = sprint;
    for (let phase = 0; phase < PHASES.length; phase++) {
      session.phase = phase;
      teams.forEach((t) => syncToPhase(t, session));
      const id = PHASES[phase].id;

      teams.forEach((t) => {
        const A = (a) => applyAction(t, session, roster(), a);
        if (id === "planning") {
          for (const f of marketFor(seed, sprint)) {
            if (usedSlots(t) + FEATURE_BY_ID[f].s <= capacity(t)) {
              if (strategy(t, f)) A({ kind: "pick", feature: f });
            }
          }
          A({ kind: "commit" });
        }
        if (id === "dev" && t.picked.length) {
          A({ kind: "rollDev" });
          if (!t.dev.pass) for (const f of t.picked) A({ kind: "decide", feature: f, how: Math.random() < 0.6 ? "push" : "shelve" });
        }
        if (id === "incident" && t.inc && !t.inc.done) A({ kind: "rollIncident" });
        if (id === "release" && t.rel && !t.rel.done) A({ kind: "rollRelease" });
        if (id === "market" && !t.eventResolved) A({ kind: "resolveEvent" });
        if (id === "retro") {
          const { PRACTICES } = require("../.test-build/cards");
          for (const p of PRACTICES) { try { A({ kind: "buy", practice: p.id }); } catch (e) { /* not affordable */ } }
        }
        check(`phase ${id} finishes for every team (sprint ${sprint})`, phaseDone(t, session));
      });
    }
  }
  return teams;
}

const strategies = {
  "growth only":  (t, f) => FEATURE_BY_ID[f].c === "growth" || FEATURE_BY_ID[f].c === "core",
  "balanced":     () => true,
  "defensive":    (t, f) => FEATURE_BY_ID[f].c !== "growth",
};

for (const [name, strat] of Object.entries(strategies)) {
  for (let run = 0; run < 12; run++) {
    const teams = playGame(1000 + run, 6, strat);
    teams.forEach((t, i) => {
      check(`${name}: customers never negative`, t.customers >= 0);
      check(`${name}: bugs never negative`, t.bugs >= 0);
      check(`${name}: findings never negative`, t.findings >= 0);
      check(`${name}: ip never negative`, t.ip >= 0);
      check(`${name}: portfolio has no duplicates`, new Set(t.portfolio).size === t.portfolio.length);
      check(`${name}: practices have no duplicates`, new Set(t.practices).size === t.practices.length);
    });
  }
}

// --- idempotence: syncing twice must not pay IP twice ---
{
  const session = { code: "X", seed: 7, sprints: 4, sprint: 1, phase: 5, reveal_incident: true, reveal_event: true, finished: false };
  const t = emptyTeamState();
  syncToPhase(t, session);
  const after = t.ip;
  syncToPhase(t, session);
  syncToPhase(t, session);
  check("retro income is paid exactly once", t.ip === after);
}

// --- a group cannot roll twice ---
{
  const session = { code: "X", seed: 7, sprints: 4, sprint: 1, phase: 0, reveal_incident: true, reveal_event: true, finished: false };
  const t = emptyTeamState();
  syncToPhase(t, session);
  const f = marketFor(7, 1).find((id) => FEATURE_BY_ID[id].s === 1);
  applyAction(t, session, [], { kind: "pick", feature: f });
  applyAction(t, session, [], { kind: "commit" });
  session.phase = 1;
  syncToPhase(t, session);
  applyAction(t, session, [], { kind: "rollDev" });
  let blocked = false;
  try { applyAction(t, session, [], { kind: "rollDev" }); } catch (e) { blocked = e instanceof GameError; }
  check("second Development roll is refused", blocked);
}

// --- phase guard ---
{
  const session = { code: "X", seed: 7, sprints: 4, sprint: 1, phase: 3, reveal_incident: true, reveal_event: true, finished: false };
  const t = emptyTeamState();
  syncToPhase(t, session);
  let blocked = false;
  try { applyAction(t, session, [], { kind: "commit" }); } catch (e) { blocked = e instanceof GameError && e.status === 409; }
  check("planning action during Release is refused", blocked);
}

// --- five bugs stops the release train ---
{
  const session = { code: "X", seed: 7, sprints: 4, sprint: 1, phase: 3, reveal_incident: true, reveal_event: true, finished: false };
  const t = emptyTeamState();
  t.bugs = 5;
  t.built = [{ id: "kyc", buggy: false, shelved: false }];
  syncToPhase(t, session);
  check("five bugs blocks the release", t.rel.blocked === true && t.rel.done === true);
}

// --- the table always offers something to sell and something to build on ---
{
  const { FEATURE_BY_ID } = require("../.test-build/cards");
  for (let seed = 1; seed <= 60; seed++) {
    for (let sprint = 1; sprint <= 8; sprint++) {
      const m = marketFor(seed * 977, sprint);
      const platform = m.filter((id) => FEATURE_BY_ID[id].c === "platform").length;
      check("three product and three platform cards on the table", platform === 3 && m.length === 6);
      check("no duplicate cards on the table", new Set(m).size === 6);
    }
  }
}

// --- a card that cannot be taken must not hold a place on the table ---
{
  const { FEATURE_BY_ID } = require("../.test-build/cards");
  let tooEarly = 0;
  for (let seed = 1; seed <= 800; seed++) {
    for (const sprint of [1, 2]) {
      if (marketFor(seed, sprint).some((id) => FEATURE_BY_ID[id].s >= 3)) tooEarly++;
    }
  }
  // Capacity is 2 until Cross-Functional Team, which cannot be bought before
  // the sprint-2 retro, so a three-slot card is unclickable in sprints 1 and 2.
  check("no three-slot card before capacity can reach three", tooEarly === 0, `${tooEarly} early`);

  let found = 0;
  for (let seed = 1; seed <= 200; seed++) {
    for (let sprint = 3; sprint <= 10; sprint++) {
      if (marketFor(seed, sprint).some((id) => FEATURE_BY_ID[id].s >= 3)) { found++; break; }
    }
  }
  check("but they still reach the table later", found > 100, `${found}/200 sessions`);
}

// --- no card is ever dealt without the feature it hangs on ---
{
  const { INCIDENT_BY_ID, EVENT_BY_ID } = require("../.test-build/cards");
  const { incidentIdFor, eventIdFor, SCHEDULE_LENGTH } = require("../.test-build/derive");
  const shownThrough = (seed, sprint) => {
    const shown = new Set();
    for (let s = 1; s <= sprint; s++) for (const id of marketFor(seed, s)) shown.add(id);
    return shown;
  };
  const satisfied = (card, shown) => {
    if (!card.needs || !card.needs.length) return true;
    const have = card.needs.filter((id) => shown.has(id)).length;
    return have >= (card.needsCount ?? card.needs.length);
  };
  let unmet = 0;
  for (let seed = 1; seed <= 500; seed++) {
    for (let sprint = 1; sprint <= SCHEDULE_LENGTH; sprint++) {
      const shown = shownThrough(seed, sprint);
      if (!satisfied(INCIDENT_BY_ID[incidentIdFor(seed, sprint)], shown)) unmet++;
      if (!satisfied(EVENT_BY_ID[eventIdFor(seed, sprint)], shown)) unmet++;
    }
  }
  check("every incident and event fits the cards the table has shown", unmet === 0, `${unmet} unmet`);

  // Adding a sprint must not rewrite what already happened.
  const first = [1, 2, 3, 4].map((k) => `${incidentIdFor(77, k)}/${eventIdFor(77, k)}`).join(",");
  const later = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => `${incidentIdFor(77, k)}/${eventIdFor(77, k)}`).slice(0, 4).join(",");
  check("extending a session leaves earlier sprints untouched", first === later);
}

// --- infrastructure bonuses are real, and capped ---
{
  const { infraBonus, INFRA_CAP, mitBonus } = require("../.test-build/rules");
  const t = emptyTeamState();
  check("no portfolio, no infrastructure bonus", infraBonus(t).mit === 0);
  t.portfolio = ["obs", "runbooks"];                       // +2 and +2
  check("infrastructure raises mitigation", infraBonus(t).mit === 4 && mitBonus(t) === 6);
  t.portfolio = ["obs", "runbooks", "shard", "lb", "svcmon", "errtrack", "backup", "dr"];
  check("mitigation bonus stops at the cap", infraBonus(t).mit === INFRA_CAP);
  t.portfolio = ["gates", "wiki", "testauto", "containers", "micro"];
  check("development bonus stops at the cap", infraBonus(t).dev <= INFRA_CAP);
}

// --- legacy drag: one platform card carries two product features ---
{
  const { legacyDrag, devTarget, DRAG_CAP } = require("../.test-build/rules");
  const t = emptyTeamState();
  check("an empty portfolio has no drag", legacyDrag(t) === 0);
  t.portfolio = ["kyc", "app"];
  check("two product features and no platform is +1", legacyDrag(t) === 1);
  t.portfolio = ["kyc", "app", "obs"];
  check("a platform card carries two product features", legacyDrag(t) === 0);
  t.portfolio = ["kyc", "app", "pots", "notify", "sepa", "cards", "fx", "robo", "crypto", "payouts", "fraud", "aml", "psd2", "sca"];
  check("drag stops at the cap", legacyDrag(t) === DRAG_CAP);
  t.picked = ["kyc"];
  check("drag raises the combined Development target", devTarget(t) > FEATURE_BY_ID.kyc.t);
}

// --- a market event may pay in investment points ---
{
  const session = { code: "X", seed: 7, sprints: 4, sprint: 1, phase: 4, reveal_incident: true, reveal_event: true, finished: false };
  const { EVENT_FX } = require("../.test-build/effects");
  const t = emptyTeamState();
  t.portfolio = ["wiki", "gates"];
  const out = EVENT_FX.hiring(t, { isLeader: false, hasFewestBugs: false });
  check("Engineering Brand pays an investment point", out.ip === 1);
}

// --- documentation keeps the bus factor above one ---
{
  const { INCIDENT_FX } = require("../.test-build/effects");
  const t = emptyTeamState();
  t.portfolio = ["wiki"];
  check("a wiki survives the lead engineer resigning", INCIDENT_FX.resign.auto(t) === true);
}

console.log(failures === 0 ? "\nAll engine checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
