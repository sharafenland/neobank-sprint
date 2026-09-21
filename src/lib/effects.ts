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
/**
 * A loss proportional to how big the bank already is, with a floor so the
 * first sprints still sting. Gains stay flat and losses scale: the more
 * customers you have, the more an outage or an enforcement action costs you,
 * which is what keeps defensive work worth buying in the late game.
 */
export function pctLoss(t: TeamState, pct: number, floor: number): number {
  return -Math.max(floor, Math.round(t.customers * pct));
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
    mod: (t) => (own(t, "sre") || has(t, "obs") ? 0 : -3) + (has(t, "cache") || has(t, "shard") ? 3 : 0),
    modTxt: (t) => {
      const parts: string[] = [];
      if (!own(t, "sre") && !has(t, "obs")) parts.push("−3: no observability, you are debugging blind");
      if (has(t, "cache") || has(t, "shard")) parts.push("+3: the read path absorbs the spike");
      return parts.join(" · ");
    },
    fail: (c) => { cust(c, pctLoss(c.t, 0.10, 8)); bug(c, 1); },
    pass: (c) => cust(c, pctLoss(c.t, 0.02, 2)),
  },
  breach: {
    mod: (t) => (has(t, "gdpr") ? 2 : -3) + (has(t, "auditlog") ? 2 : 0),
    modTxt: (t) => {
      const parts = [has(t, "gdpr")
        ? "+2: retention and access controls limit the blast radius"
        : "−3: no privacy controls, the whole archive is in scope"];
      if (has(t, "auditlog")) parts.push("+2: the audit log shows exactly what was reached");
      return parts.join(" · ");
    },
    fail: (c) => {
      cust(c, pctLoss(c.t, has(c.t, "gdpr") ? 0.14 : 0.26, has(c.t, "gdpr") ? 14 : 24));
      finding(c, has(c.t, "gdpr") ? 1 : 2);
    },
    pass: (c) => cust(c, pctLoss(c.t, 0.04, 4)),
  },
  resign: {
    auto: (t) => own(t, "pair") || has(t, "wiki"),
    fail: (c) => { c.t.devMod -= 3; log(c, "−3 on this sprint's Development roll", "down"); },
  },
  audit: {
    mod: (t) => (has(t, "aml") ? 3 : 0) + (has(t, "auditlog") ? 2 : 0),
    modTxt: (t) => {
      const parts: string[] = [];
      if (has(t, "aml")) parts.push("+3: AML Monitoring produces the evidence they asked for");
      if (has(t, "auditlog")) parts.push("+2: the audit trail is already exportable");
      return parts.join(" · ");
    },
    fail: (c) => finding(c, 2),
  },
  scheme: {
    mod: (t) => (own(t, "cicd") ? 3 : 0),
    modTxt: (t) => (own(t, "cicd") ? "+3: you can ship a hotfix the same day" : ""),
    fail: (c) => { c.t.blockRelease = true; log(c, "Releases blocked this sprint", "down"); },
  },
  fraudring: {
    auto: (t) => has(t, "fraud"),
    mod: (t) => (has(t, "ratelimit") ? 3 : 0),
    modTxt: (t) => (has(t, "ratelimit") ? "+3: per-client quotas make card testing expensive" : ""),
    fail: (c) => { cust(c, pctLoss(c.t, 0.13, 10)); finding(c, 1); },
    pass: (c) => cust(c, pctLoss(c.t, 0.03, 3)),
  },
  region: {
    auto: (t) => has(t, "dr"),
    mod: (t) => (has(t, "backup") ? 3 : 0) + (has(t, "lb") ? 1 : 0),
    modTxt: (t) => {
      const parts: string[] = [];
      if (has(t, "backup")) parts.push("+3: a tested restore, not a hopeful one");
      if (has(t, "lb")) parts.push("+1: traffic drains to what is still up");
      return parts.join(" · ");
    },
    fail: (c) => cust(c, pctLoss(c.t, 0.16, 12)),
    pass: (c) => cust(c, pctLoss(c.t, 0.04, 4)),
  },
  cve: {
    mod: (t) => (own(t, "tests") || has(t, "testauto") ? 3 : 0) + (has(t, "gates") ? 1 : 0) + (has(t, "containers") ? 1 : 0),
    modTxt: (t) => {
      const parts: string[] = [];
      if (own(t, "tests") || has(t, "testauto")) parts.push("+3: the test suite tells you the upgrade is safe");
      if (has(t, "gates")) parts.push("+1: the gate blocks the vulnerable version");
      if (has(t, "containers")) parts.push("+1: one image to rebuild, not twelve hosts");
      return parts.join(" · ");
    },
    fail: (c) => bug(c, 2),
  },
  sla: {
    only: (t) => has(t, "sepa"),
    fail: (c) => { cust(c, pctLoss(c.t, 0.12, 9)); finding(c, 1); },
    pass: (c) => cust(c, pctLoss(c.t, 0.02, 2)),
  },
  warroom: {
    auto: (t) => own(t, "blameless"),
    fail: (c) => { c.t.ipPenalty = 1; log(c, "−1 Investment Point this retro", "down"); },
  },
  reporting: {
    auto: (t) => has(t, "dwh"),
    mod: (t) => (has(t, "pipeline") ? 3 : 0),
    modTxt: (t) => (has(t, "pipeline") ? "+3: the pipeline has the numbers, they just need assembling" : ""),
    fail: (c) => { finding(c, 1); cust(c, pctLoss(c.t, 0.05, 4)); },
  },
  phish: {
    mod: (t) => (has(t, "sca") ? 4 : 0) + (has(t, "ratelimit") ? 2 : 0),
    modTxt: (t) => {
      const parts: string[] = [];
      if (has(t, "sca")) parts.push("+4: Strong Customer Authentication stops the stolen credentials");
      if (has(t, "ratelimit")) parts.push("+2: the credential-stuffing run is throttled");
      return parts.join(" · ");
    },
    fail: (c) => cust(c, pctLoss(c.t, 0.09, 7)),
    pass: (c) => cust(c, pctLoss(c.t, 0.01, 1)),
  },
};

export interface EventCtx {
  isLeader: boolean;
  hasFewestBugs: boolean;
}
export interface EventOutcome {
  d: number;
  f?: number;
  /** Investment points, for the cards that pay in capability rather than customers. */
  ip?: number;
  w: string;
}

export const EVENT_FX: Record<string, (t: TeamState, ctx: EventCtx) => EventOutcome> = {
  dora: (t) => (has(t, "dr")
    ? { d: 12, w: "Resilience evidence accepted" }
    : { d: pctLoss(t, 0.10, 6), f: 1, w: "No tested failover — finding raised" }),
  gdprwave: (t) => (has(t, "gdpr")
    ? { d: 8, w: "Clean data practices, free press" }
    : { d: pctLoss(t, 0.16, 10), w: "Named in the enforcement round-up" }),
  ipr: (t) => (has(t, "sepa")
    ? { d: 15, w: "Ready on day one" }
    : { d: pctLoss(t, 0.09, 5), w: "Customers leave for banks that are" }),
  winter: (t, ctx) => (ctx.isLeader
    ? { d: pctLoss(t, 0.14, 11), w: "Leader under the most scrutiny" }
    : { d: pctLoss(t, 0.07, 5), w: "Growth budget cut" }),
  feature: (_t, ctx) => (ctx.isLeader
    ? { d: 13, w: "Featured — the rich get richer" }
    : { d: 0, w: "Not this quarter" }),
  mica: (t) => (has(t, "crypto")
    ? { d: 18, w: "Licensed and first to market" }
    : { d: 0, w: "Nothing to license" }),
  rates: (t) => (has(t, "pots")
    ? { d: 14, w: "Savings Pots fill up" }
    : { d: pctLoss(t, 0.05, 3), w: "Deposits drift elsewhere" }),
  openbank: (t) => (has(t, "psd2")
    ? { d: 11, w: "Onboarded through the aggregator" }
    : { d: 0, w: "Not reachable" }),
  viral: (t, ctx) => (ctx.hasFewestBugs
    ? { d: 12, w: "Cleanest run in the test" }
    : { d: pctLoss(t, 0.04 * t.bugs, 2 * t.bugs), w: `${t.bugs} bug${t.bugs === 1 ? "" : "s"} on camera` }),
  pricewar: (t) => (has(t, "app")
    ? { d: pctLoss(t, 0.02, 1), w: "The app is why people stay" }
    : { d: pctLoss(t, 0.12, 7), w: "Nothing to differentiate on" }),
  latency: (t) => {
    const fast = [has(t, "cdn"), has(t, "cache"), has(t, "profiling")].filter(Boolean).length;
    if (fast >= 2) return { d: 12, w: "Fastest app in the table" };
    if (fast === 1) return { d: 3, w: "Mid-table, and nobody switches for mid-table" };
    return { d: pctLoss(t, 0.10, 6), w: "Slowest app in the table, in print" };
  },
  hiring: (t) => {
    const attractive = [has(t, "wiki"), has(t, "gates"), has(t, "testauto")].filter(Boolean).length;
    return attractive >= 2
      ? { d: 2, ip: 1, w: "Both engineers sign — the codebase sold itself" }
      : { d: 0, w: "They went somewhere with a tidier repository" };
  },
  trust: (t) => (t.findings === 0
    ? { d: 9, w: "Spotless record" }
    : t.findings >= 3
      ? { d: pctLoss(t, 0.15, 9), w: `${t.findings} open findings` }
      : { d: pctLoss(t, 0.05, 3), w: `${t.findings} open finding${t.findings === 1 ? "" : "s"}` }),
};
