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
check("market rotates by 2", marketFor(999, 1)[2] === marketFor(999, 2)[0]);
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

console.log(failures === 0 ? "\nAll engine checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
