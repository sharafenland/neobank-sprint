/**
 * Plays a whole session against a running server: creates it, joins two
 * groups, and drives every phase of every sprint through the HTTP API.
 * Verifies the parts the unit test cannot — SQL, auth, phase control.
 *
 *   BASE=http://localhost:3000 node scripts/smoke-api.mjs
 */
const BASE = process.env.BASE ?? "http://localhost:3000";
const SPRINTS = Number(process.env.SPRINTS ?? 3);

let failures = 0;
const check = (label, cond, extra) => {
  if (cond) console.log("  ok  ", label);
  else { failures++; console.log("  FAIL", label, extra ?? ""); }
};

async function call(path, { method = "GET", body, host, team } = {}) {
  const headers = { "content-type": "application/json" };
  if (host) headers["x-host-token"] = host;
  if (team) headers["x-team-token"] = team;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const phaseName = ["planning", "dev", "incident", "release", "market", "retro"];

console.log(`\nPlaying a ${SPRINTS}-sprint session against ${BASE}\n`);

// ---- create ----
const bad = await call("/api/sessions", { method: "POST", body: { sprints: 5 } });
check("an invalid sprint count is rejected", bad.status === 400, bad.json);

const created = await call("/api/sessions", { method: "POST", body: { sprints: SPRINTS } });
check("session created", created.status === 201 && /^[A-Z0-9]{4}$/.test(created.json.code ?? ""), created.json);
const { code, hostToken } = created.json;
console.log(`  code ${code}\n`);

// ---- join ----
const a = await call(`/api/sessions/${code}/teams`, { method: "POST", body: { name: "Gruppe A" } });
const b = await call(`/api/sessions/${code}/teams`, { method: "POST", body: { name: "Gruppe B" } });
check("two groups joined", a.status === 201 && b.status === 201, [a.json, b.json]);
const A = a.json.token, B = b.json.token;

const again = await call(`/api/sessions/${code}/teams`, { method: "POST", body: { name: "gruppe a" } });
check("rejoining by name is case-insensitive and keeps the token", again.status === 200 && again.json.token === A);

const short = await call(`/api/sessions/${code}/teams`, { method: "POST", body: { name: "x" } });
check("a one-character group name is rejected", short.status === 400);

// ---- auth ----
const notHost = await call(`/api/sessions/${code}/phase`, { method: "POST", body: { op: "next" } });
check("a group cannot move the room", notHost.status === 403, notHost.json);
const noTeam = await call(`/api/sessions/${code}/actions`, { method: "POST", body: { kind: "commit" } });
check("an unjoined device cannot act", noTeam.status === 401, noTeam.json);

// ---- play ----
let lastCustomers = {};
for (let sprint = 1; sprint <= SPRINTS; sprint++) {
  for (let phase = 0; phase < 6; phase++) {
    const view = (await call(`/api/sessions/${code}`, { host: hostToken })).json;
    if (view.session.sprint !== sprint || view.session.phase !== phase) {
      check(`server is at sprint ${sprint} phase ${phaseName[phase]}`, false,
        `got sprint ${view.session.sprint} phase ${view.session.phase}`);
    }
    const id = phaseName[phase];

    if (id === "incident") await call(`/api/sessions/${code}/phase`, { method: "POST", body: { op: "revealIncident" }, host: hostToken });
    if (id === "market") await call(`/api/sessions/${code}/phase`, { method: "POST", body: { op: "revealEvent" }, host: hostToken });

    for (const token of [A, B]) {
      const me = (await call(`/api/sessions/${code}`, { team: token })).json;
      const t = me.you.state;
      const act = (action) => call(`/api/sessions/${code}/actions`, { method: "POST", body: action, team: token });

      if (id === "planning") {
        for (const f of me.market.slice(0, 3)) await act({ kind: "pick", feature: f });
        const r = await act({ kind: "commit" });
        if (sprint === 1 && token === A) check("plan committed", r.status === 200, r.json);
      }
      if (id === "dev") {
        const r = await act({ kind: "rollDev" });
        if (sprint === 1 && token === A) {
          check("development rolled server-side", r.status === 200 && typeof r.json.state.dev?.roll === "number", r.json);
          const twice = await act({ kind: "rollDev" });
          check("a second roll in the same sprint is refused", twice.status === 409, twice.json);
        }
        const after = (await call(`/api/sessions/${code}`, { team: token })).json.you.state;
        if (after.dev && !after.dev.pass) {
          for (const f of after.picked) await act({ kind: "decide", feature: f, how: "push" });
        }
      }
      if (id === "incident") {
        const st = (await call(`/api/sessions/${code}`, { team: token })).json.you.state;
        if (st.inc && !st.inc.done) await act({ kind: "rollIncident" });
      }
      if (id === "release") {
        const st = (await call(`/api/sessions/${code}`, { team: token })).json.you.state;
        if (st.rel && !st.rel.done) await act({ kind: "rollRelease" });
      }
      if (id === "market") {
        const r = await act({ kind: "resolveEvent" });
        if (r.status === 200) {
          const twice = await act({ kind: "resolveEvent" });
          if (sprint === 1 && token === A) check("an event cannot be resolved twice", twice.status === 409, twice.json);
        }
      }
      if (id === "retro") {
        const st = (await call(`/api/sessions/${code}`, { team: token })).json.you.state;
        if (st.ip >= 1) await act({ kind: "buy", practice: "blameless" });
      }
      if (id === "planning" && sprint === 2 && token === A) {
        const wrong = await act({ kind: "rollDev" });
        check("an action from another phase is refused", wrong.status === 409, wrong.json);
      }
    }

    const done = (await call(`/api/sessions/${code}`, { host: hostToken })).json;
    check(`sprint ${sprint} ${id}: both groups finished`, done.teams.every((x) => x.phaseDone),
      done.teams.map((x) => `${x.name}:${x.phaseDone}`).join(" "));
    if (id === "planning") {
      check(`sprint ${sprint} planning: the table is 3 product + 3 platform`, done.market.length === 6);
    }

    const adv = await call(`/api/sessions/${code}/phase`, { method: "POST", body: { op: "next" }, host: hostToken });
    check(`sprint ${sprint} ${id}: room advanced`, adv.status === 200, adv.json);
  }
  const after = (await call(`/api/sessions/${code}`, { host: hostToken })).json;
  const line = after.teams.map((t) => `${t.name} ${t.customers}k/${t.bugs}b/${t.findings}f`).join("   ");
  console.log(`  — after sprint ${sprint}: ${line}`);
  lastCustomers = Object.fromEntries(after.teams.map((t) => [t.name, t.customers]));
}

// ---- end ----
const final = (await call(`/api/sessions/${code}`, { host: hostToken })).json;
check("session is finished", final.session.finished === true, final.session);
const blocked = await call(`/api/sessions/${code}/actions`, { method: "POST", body: { kind: "commit" }, team: A });
check("a finished session refuses further actions", blocked.status === 409, blocked.json);
// Not "someone finished with customers" — that asserts on dice, and a bad run
// can legitimately leave both groups at zero. Assert that the session actually
// recorded play for each of them.
for (const [label, token] of [["Gruppe A", A], ["Gruppe B", B]]) {
  const mine = (await call(`/api/sessions/${code}`, { team: token })).json;
  const st = mine.you.state;
  check(`${label} accumulated a sprint log`, st.feed.length > 0, st.feed.length);
  check(`${label} carries the applied markers for every phase played`,
    Object.keys(st.applied).length >= SPRINTS * 6, Object.keys(st.applied).length);
}
console.log("  final:", JSON.stringify(lastCustomers));

// ---- the facilitator can stop early and can add a sprint ----
{
  const s2 = (await call("/api/sessions", { method: "POST", body: { sprints: 3 } })).json;
  const h2 = s2.hostToken;
  const atRetro = async () => {
    for (let i = 0; i < 5; i++) await call(`/api/sessions/${s2.code}/phase`, { method: "POST", body: { op: "next" }, host: h2 });
  };
  await atRetro();
  let v = (await call(`/api/sessions/${s2.code}`, { host: h2 })).json;
  check("walked to the first retro", phaseName[v.session.phase] === "retro", v.session);

  const ended = await call(`/api/sessions/${s2.code}/phase`, { method: "POST", body: { op: "finish" }, host: h2 });
  v = (await call(`/api/sessions/${s2.code}`, { host: h2 })).json;
  check("the facilitator can end the game after any sprint", ended.status === 200 && v.session.finished === true, v.session);

  const notYours = await call(`/api/sessions/${s2.code}/phase`, { method: "POST", body: { op: "finish" } });
  check("ending the game needs the host token", notYours.status === 403);
}
{
  const s3 = (await call("/api/sessions", { method: "POST", body: { sprints: 3 } })).json;
  const h3 = s3.hostToken;
  const ext = await call(`/api/sessions/${s3.code}/phase`, { method: "POST", body: { op: "extend" }, host: h3 });
  const v = (await call(`/api/sessions/${s3.code}`, { host: h3 })).json;
  check("a sprint can be added", ext.status === 200 && v.session.sprints === 4, v.session);

  for (let i = 0; i < 9; i++) await call(`/api/sessions/${s3.code}/phase`, { method: "POST", body: { op: "extend" }, host: h3 });
  const tooMany = await call(`/api/sessions/${s3.code}/phase`, { method: "POST", body: { op: "extend" }, host: h3 });
  check("extending stops at twelve sprints", tooMany.status === 400, tooMany.json);
}

const missing = await call("/api/sessions/ZZZZ");
check("an unknown code is a 404", missing.status === 404);

console.log(failures === 0 ? "\nAll API checks passed.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
