/**
 * What the cards actually do. Server-only: these functions mutate a team's
 * state, so they never run on a device the players control.
 */
import { has, own } from "./rules";
import type { TeamState } from "./types";

export interface Fx {
  t: TeamState;
  sprint: number;
}

const sgn = (n: number) => (n > 0 ? "+" : "") + n;

export function log(c: Fx, txt: string, dir: "" | "up" | "down" = "") {
  c.t.feed.unshift({ s: c.sprint, txt, dir });
  if (c.t.feed.length > 120) c.t.feed.length = 120;
}
export function cust(c: Fx, n: number) {
  c.t.customers = Math.max(0, c.t.customers + n);
  log(c, `${sgn(n)}k customers`, n >= 0 ? "up" : "down");
}
export function bug(c: Fx, n: number) {
  c.t.bugs = Math.max(0, c.t.bugs + n);
  log(c, `${sgn(n)} bug${Math.abs(n) === 1 ? "" : "s"}`, n >= 0 ? "down" : "up");
}
export function finding(c: Fx, n: number) {
  c.t.findings = Math.max(0, c.t.findings + n);
  log(c, `${sgn(n)} audit finding${Math.abs(n) === 1 ? "" : "s"}`, n >= 0 ? "down" : "up");
}

export interface IncidentSpec {
  /** Some cards only expose teams that built a particular thing. */
  only?: (t: TeamState) => boolean;
  /** Portfolio or practice that removes the card entirely. */
  auto?: (t: TeamState) => boolean;
  /** Modifier on the mitigation roll, and the reason to print next to it. */
  mod?: (t: TeamState) => number;
  modTxt?: (t: TeamState) => string;
  fail: (c: Fx) => void;
  pass?: (c: Fx) => void;
}

export const INCIDENT_FX: Record<string, IncidentSpec> = {
  outage: {
    mod: (t) => (own(t, "sre") || has(t, "obs") ? 0 : -3),
    modTxt: (t) => (own(t, "sre") || has(t, "obs") ? "" : "−3: no observability, you are debugging blind"),
    fail: (c) => { cust(c, -8); bug(c, 1); },
    pass: (c) => cust(c, -2),
  },
  breach: {
    mod: (t) => (has(t, "gdpr") ? 2 : -3),
    modTxt: (t) => (has(t, "gdpr")
      ? "+2: retention and access controls limit the blast radius"
      : "−3: no privacy controls, the whole archive is in scope"),
    fail: (c) => { cust(c, has(c.t, "gdpr") ? -14 : -24); finding(c, has(c.t, "gdpr") ? 1 : 2); },
    pass: (c) => cust(c, -4),
  },
  resign: {
    auto: (t) => own(t, "pair"),
    fail: (c) => { c.t.devMod -= 3; log(c, "−3 on this sprint's Development roll", "down"); },
  },
  audit: {
    mod: (t) => (has(t, "aml") ? 3 : 0),
    modTxt: (t) => (has(t, "aml") ? "+3: AML Monitoring produces the evidence they asked for" : ""),
    fail: (c) => finding(c, 2),
  },
  scheme: {
    mod: (t) => (own(t, "cicd") ? 3 : 0),
    modTxt: (t) => (own(t, "cicd") ? "+3: you can ship a hotfix the same day" : ""),
    fail: (c) => { c.t.blockRelease = true; log(c, "Releases blocked this sprint", "down"); },
  },
  fraudring: {
    auto: (t) => has(t, "fraud"),
    fail: (c) => { cust(c, -10); finding(c, 1); },
    pass: (c) => cust(c, -3),
  },
  region: {
    auto: (t) => has(t, "dr"),
    fail: (c) => cust(c, -12),
    pass: (c) => cust(c, -4),
  },
  cve: {
    mod: (t) => (own(t, "tests") ? 3 : 0),
    modTxt: (t) => (own(t, "tests") ? "+3: the test suite tells you the upgrade is safe" : ""),
    fail: (c) => bug(c, 2),
  },
  sla: {
    only: (t) => has(t, "sepa"),
    fail: (c) => { cust(c, -9); finding(c, 1); },
    pass: (c) => cust(c, -2),
  },
  warroom: {
    auto: (t) => own(t, "blameless"),
    fail: (c) => { c.t.ipPenalty = 1; log(c, "−1 Investment Point this retro", "down"); },
  },
  reporting: {
    auto: (t) => has(t, "dwh"),
    fail: (c) => { finding(c, 1); cust(c, -4); },
  },
  phish: {
    mod: (t) => (has(t, "sca") ? 4 : 0),
    modTxt: (t) => (has(t, "sca") ? "+4: Strong Customer Authentication stops the stolen credentials" : ""),
    fail: (c) => cust(c, -7),
    pass: (c) => cust(c, -1),
  },
};

export interface EventCtx {
  isLeader: boolean;
  hasFewestBugs: boolean;
}
export interface EventOutcome {
  d: number;
  f?: number;
  w: string;
}

export const EVENT_FX: Record<string, (t: TeamState, ctx: EventCtx) => EventOutcome> = {
  dora: (t) => (has(t, "dr")
    ? { d: 12, w: "Resilience evidence accepted" }
    : { d: -6, f: 1, w: "No tested failover — finding raised" }),
  gdprwave: (t) => (has(t, "gdpr")
    ? { d: 8, w: "Clean data practices, free press" }
    : { d: -10, w: "Named in the enforcement round-up" }),
  ipr: (t) => (has(t, "sepa")
    ? { d: 15, w: "Ready on day one" }
    : { d: -5, w: "Customers leave for banks that are" }),
  winter: (_t, ctx) => (ctx.isLeader
    ? { d: -11, w: "Leader under the most scrutiny" }
    : { d: -5, w: "Growth budget cut" }),
  feature: (_t, ctx) => (ctx.isLeader
    ? { d: 13, w: "Featured — the rich get richer" }
    : { d: 0, w: "Not this quarter" }),
  mica: (t) => (has(t, "crypto")
    ? { d: 18, w: "Licensed and first to market" }
    : { d: 0, w: "Nothing to license" }),
  rates: (t) => (has(t, "pots")
    ? { d: 14, w: "Savings Pots fill up" }
    : { d: -3, w: "Deposits drift elsewhere" }),
  openbank: (t) => (has(t, "psd2")
    ? { d: 11, w: "Onboarded through the aggregator" }
    : { d: 0, w: "Not reachable" }),
  viral: (t, ctx) => (ctx.hasFewestBugs
    ? { d: 12, w: "Cleanest run in the test" }
    : { d: -2 - 2 * t.bugs, w: `${t.bugs} bug${t.bugs === 1 ? "" : "s"} on camera` }),
  pricewar: (t) => (has(t, "app")
    ? { d: -1, w: "The app is why people stay" }
    : { d: -7, w: "Nothing to differentiate on" }),
  trust: (t) => (t.findings === 0
    ? { d: 9, w: "Spotless record" }
    : t.findings >= 3
      ? { d: -9, w: `${t.findings} open findings` }
      : { d: -3, w: `${t.findings} open finding${t.findings === 1 ? "" : "s"}` }),
};
