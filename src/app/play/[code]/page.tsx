"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { EVENT_BY_ID, FEATURE_BY_ID, INCIDENT_BY_ID, PHASES, PRACTICES, PRACTICE_BY_ID } from "@/lib/cards";
import { act } from "@/lib/client";
import { INCIDENT_FX } from "@/lib/effects";
import {
  FIX_PER_SLOT, INFRA_CAP, IP_BONUS_FROM_SPRINT, capacity, devBonus, devTarget, infraBonus, legacyDrag,
  maxFixSlots, mitBonus, own, relBonus, relTarget, releasing, usedSlots,
} from "@/lib/rules";
import type { TeamState } from "@/lib/types";
import { useGame } from "@/components/useGame";
import { CardIcon } from "@/components/CardIcon";
import { CheatSheet, Die, ErrorBar, FeatureCard, PhaseHead, Stepper, sgn } from "@/components/ui";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export default function Play() {
  const code = String(useParams().code ?? "").toUpperCase();
  const { view, error, refresh } = useGame(code);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!view) return <div className="setup"><p className="empty">{error ?? "Loading the session…"}</p></div>;
  if (!view.you) {
    return (
      <div className="setup">
        <h1 style={{ fontSize: 26 }}>This device has not joined {code}</h1>
        <p className="lede" style={{ fontSize: 15 }}>
          Go back to the start page and join with the code and your group&rsquo;s name. If your group already joined on
          another device, use the same name and you will pick up where it left off.
        </p>
        <p style={{ marginTop: 14 }}><Link className="btn" href="/">Back to the start</Link></p>
      </div>
    );
  }

  const s = view.session;
  const t = view.you.state;
  const phase = PHASES[s.phase];

  async function send(action: unknown) {
    setBusy(true);
    setActionError(null);
    try {
      await act(code, action);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (s.finished) return <TeamDebrief name={view.you.name} t={t} />;

  return (
    <>
      <header className="tbar"><div className="tbar-in">
        <span className="nm"><span className="dot" style={{ background: "var(--accent)" }} />{view.you.name}</span>
        <div className="tsplit">
          <span className="metric"><b>{t.customers}k</b><span>Customers</span></span>
          <span className={`metric ${t.bugs >= 5 ? "crit" : t.bugs >= 3 ? "warn" : ""}`}><b>{t.bugs}</b><span>Bugs</span></span>
          <span className={`metric ${t.findings >= 3 ? "crit" : t.findings >= 2 ? "warn" : ""}`}><b>{t.findings}</b><span>Findings</span></span>
          <span className="metric"><b>{t.ip}</b><span>IP</span></span>
          <span className="metric"><b>{s.sprint}/{s.sprints}</b><span>Sprint</span></span>
          <ThemeSwitch />
        </div>
      </div></header>

      <Stepper phase={s.phase} />

      <main className="solo">
        <div>
          <ErrorBar message={actionError} onDismiss={() => setActionError(null)} />
          <div className="panel">
            <PhaseHead
              phase={phase}
              extra={
                phase.id === "planning" ? (
                  <div style={{ textAlign: "right" }}>
                    <div className="eyebrow">Slots</div>
                    <div className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{usedSlots(t)} / {capacity(t)}</div>
                  </div>
                ) : phase.id === "retro" ? (
                  <div style={{ textAlign: "right" }}>
                    <div className="eyebrow">Investment points</div>
                    <div className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{t.ip}</div>
                  </div>
                ) : undefined
              }
            />
            <div className="panel-body">
              {phase.id === "planning" && <Planning t={t} market={view.market} busy={busy} send={send} />}
              {phase.id === "dev" && <Development t={t} busy={busy} send={send} />}
              {phase.id === "incident" && <Incident t={t} id={view.incidentId} revealed={s.reveal_incident} busy={busy} send={send} />}
              {phase.id === "release" && <Release t={t} busy={busy} send={send} />}
              {phase.id === "market" && <MarketEvent t={t} id={view.eventId} revealed={s.reveal_event} busy={busy} send={send} />}
              {phase.id === "retro" && <Retro t={t} sprint={s.sprint} busy={busy} send={send} />}
            </div>
          </div>
        </div>

        <aside className="rail">
          <CheatSheet t={t} phase={phase} />
          <div className="ledger">
            <div className="ledger-h"><span className="dot" style={{ background: "var(--accent)" }} /><b>What you own</b></div>
            {(() => {
              const infra = infraBonus(t);
              if (!infra.dev && !infra.rel && !infra.mit) return null;
              const capped = infra.dev === INFRA_CAP || infra.rel === INFRA_CAP || infra.mit === INFRA_CAP;
              return (
                <div className="chips">
                  <span className="chip on">
                    Infrastructure gives you Dev {sgn(infra.dev)} &middot; Rel {sgn(infra.rel)} &middot; Mit {sgn(infra.mit)}
                    {capped ? ` (capped at ${INFRA_CAP})` : ""}
                  </span>
                </div>
              );
            })()}
            {t.practices.length > 0 && (
              <div className="chips">
                {t.practices.map((p) => <span key={p} className="chip on">{PRACTICE_BY_ID[p].n}</span>)}
              </div>
            )}
            {t.portfolio.length > 0 && (
              <div className="chips" style={{ borderTop: "1px solid var(--line)" }}>
                {t.portfolio.map((f) => <span key={f} className="chip">{FEATURE_BY_ID[f].n}</span>)}
              </div>
            )}
            {t.practices.length === 0 && t.portfolio.length === 0 && (
              <div className="chips"><span className="empty" style={{ fontSize: 12.5 }}>Nothing shipped or adopted yet.</span></div>
            )}
          </div>
          {t.feed.length > 0 && (
            <div className="feed">
              <h3>Your log</h3>
              <ul>
                {t.feed.slice(0, 40).map((e, i) => (
                  <li key={i} className={e.dir}><span className="who">S{e.s}</span><span className="txt">{e.txt}</span></li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </main>

      <div className="footbar"><div className="footbar-in">
        <span className="hint">
          {view.teams.find((x) => x.name === view.you!.name)?.phaseDone
            ? "Done. The facilitator moves the room on."
            : phase.lead}
        </span>
        <span className="mono" style={{ fontSize: 12.5, color: "var(--faint)" }}>Code {s.code}</span>
      </div></div>
    </>
  );
}

type Send = (action: unknown) => Promise<void>;

function Planning({ t, market, busy, send }: { t: TeamState; market: string[]; busy: boolean; send: Send }) {
  const cap = capacity(t);
  const used = usedSlots(t);
  return (
    <>
      {t.findings >= 3 && (
        <p style={{ margin: "0 0 12px", color: "var(--bad)", fontSize: 13.5 }}>
          Three open findings. The supervisor has withheld one of your slots until you clear them.
        </p>
      )}
      <div className="market">
        {market.map((id) => {
          const on = t.picked.includes(id);
          const size = FEATURE_BY_ID[id].s;
          const tooBig = size > cap;
          const noRoom = !tooBig && used + size > cap;
          return (
            <FeatureCard
              key={id} id={id} on={on}
              disabled={busy || (!on && (t.confirmed || tooBig || noRoom))}
              reason={
                on || t.confirmed ? undefined
                  : tooBig ? `Takes ${size} slots. Cross-Functional Team buys you the third.`
                  : noRoom ? "No slots left this sprint."
                  : undefined
              }
              onPick={(f) => send({ kind: "pick", feature: f })}
            />
          );
        })}
      </div>
      <Remediation t={t} busy={busy} send={send} />
      <div className="spread" style={{ marginTop: 16 }}>
        <div className="calc">
          Combined Dev target <b>{t.picked.length ? devTarget(t) : "\u2014"}</b>
          {legacyDrag(t) > 0 && <span style={{ color: "var(--bad)" }}> (+{legacyDrag(t)} legacy drag)</span>}
          {own(t, "modular") && t.picked.length >= 2 && <span style={{ color: "var(--accent)" }}> (&minus;3 modular)</span>}
          {" · "}Release target <b>{t.picked.reduce((a, id) => a + FEATURE_BY_ID[id].r, 0)}</b>
        </div>
        {legacyDrag(t) > 0 && (
          <p style={{ margin: "8px 0 0", flexBasis: "100%", fontSize: 12.5, color: "var(--muted)" }}>
            Your product features have outgrown your platform. One platform card carries two product features;
            everything past that adds +1 to the Development target{legacyDrag(t) >= 6 ? ", and you are at the cap" : ""}.
          </p>
        )}
        {t.confirmed ? (
          <button className="btn ghost" disabled={busy} onClick={() => send({ kind: "unlock" })}>Reopen the plan</button>
        ) : (
          <button className="btn" disabled={busy} onClick={() => send({ kind: "commit" })}>
            {t.picked.length ? "Commit this sprint\u2019s plan" : "Take no new work this sprint"}
          </button>
        )}
      </div>
    </>
  );
}

/**
 * Without this a team at five bugs simply waits: releases are blocked, the only
 * lever is a practice that clears one bug a retro, and nothing they decide in
 * between changes anything. A slot spent here is a sprint's earnings given up
 * to get moving again — the trade every team eventually has to make.
 */
function Remediation({ t, busy, send }: { t: TeamState; busy: boolean; send: Send }) {
  if (t.bugs === 0 && t.findings === 0) return null;
  const max = maxFixSlots(t);
  const free = capacity(t) - usedSlots(t);
  const fix = t.fix ?? { bugs: 0, findings: 0 };

  const row = (what: "bugs" | "findings", debt: number, per: number) => {
    if (debt === 0) return null;
    const n = fix[what];
    return (
      <div className="fixrow" key={what}>
        <span className="lab">
          {what === "bugs" ? "Fix bugs" : "Clear findings"}
          <span className="sub">one slot removes {per}, you have {debt}</span>
        </span>
        <span className="stepper-ctl">
          <button className="btn ghost sm" disabled={busy || t.confirmed || n === 0}
            onClick={() => send({ kind: "fix", what, delta: -1 })} aria-label={`One slot less on ${what}`}>&minus;</button>
          <b className="mono">{n}</b>
          <button className="btn ghost sm" disabled={busy || t.confirmed || free < 1 || n >= max[what]}
            onClick={() => send({ kind: "fix", what, delta: 1 })} aria-label={`One slot more on ${what}`}>+</button>
        </span>
        <span className="outcome mono">
          {n > 0 ? `${what === "bugs" ? t.bugs : t.findings} \u2192 ${Math.max(0, (what === "bugs" ? t.bugs : t.findings) - n * per)}` : "\u2014"}
        </span>
      </div>
    );
  };

  return (
    <div className="fixbox">
      <span className="eyebrow">Pay down debt instead of taking new work</span>
      {row("bugs", t.bugs, FIX_PER_SLOT.bugs)}
      {row("findings", t.findings, FIX_PER_SLOT.findings)}
      {t.bugs >= 5 && (
        <p className="warn">
          At five bugs nothing ships at all. One slot here brings you back under the line this sprint.
        </p>
      )}
    </div>
  );
}

function Development({ t, busy, send }: { t: TeamState; busy: boolean; send: Send }) {
  if (!t.picked.length) return <p className="empty">You committed nothing this sprint. Nothing to roll.</p>;
  if (!t.dev) {
    return (
      <div className="rollbox">
        <Die />
        <div className="calc">
          Target <b>{devTarget(t)}</b> = {t.picked.map((id) => FEATURE_BY_ID[id].t).join(" + ")}
          {legacyDrag(t) > 0 ? ` + ${legacyDrag(t)} legacy drag` : ""}
          {own(t, "modular") && t.picked.length >= 2 ? " − 3" : ""}<br />
          Roll <b>d20 {sgn(devBonus(t))}</b>
          {t.devMod !== 0 && <span style={{ color: "var(--bad)" }}> (incident penalty included)</span>}
        </div>
        <button className="btn" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => send({ kind: "rollDev" })}>Roll to build</button>
      </div>
    );
  }
  return (
    <>
      <div className="rollbox">
        <Die value={t.dev.roll} />
        <div className="calc">
          {t.dev.roll} {sgn(devBonus(t))} = <b>{t.dev.total}</b> against <b>{t.dev.target}</b><br />
          <span className={`verdict ${t.dev.pass ? "ok" : "no"}`}>{t.dev.pass ? "Everything built" : "Missed the bar"}</span>
        </div>
      </div>
      {!t.dev.pass && (
        <div className="decide">
          {t.picked.map((id) => {
            const done = t.dev!.decided[id];
            return (
              <div key={id} className="dline">
                <b>{FEATURE_BY_ID[id].n}</b>
                {done ? (
                  <span className="mono" style={{ fontSize: 12.5, color: done === "push" ? "var(--bad)" : "var(--muted)" }}>
                    {done === "push" ? "pushed through" : "shelved"}
                  </span>
                ) : (
                  <>
                    <button className="btn sm danger" disabled={busy} onClick={() => send({ kind: "decide", feature: id, how: "push" })}>
                      Push through {own(t, "dod") ? "(no bug)" : own(t, "agentic") ? "(+2 bugs)" : "(+1 bug)"}
                    </button>
                    <button className="btn sm ghost" disabled={busy} onClick={() => send({ kind: "decide", feature: id, how: "shelve" })}>
                      Shelve{own(t, "flags") ? " (20% via flags)" : ""}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Incident({ t, id, revealed, busy, send }: { t: TeamState; id: string; revealed: boolean; busy: boolean; send: Send }) {
  if (!revealed) return <p className="empty">Waiting for the facilitator to turn the card over.</p>;
  const card = INCIDENT_BY_ID[id];
  const spec = INCIDENT_FX[id];
  const mod = spec.mod ? spec.mod(t) : 0;
  const modTxt = spec.modTxt ? spec.modTxt(t) : "";
  const inc = t.inc;

  return (
    <>
      <div className="eventcard risk" style={{ marginBottom: 14 }}>
        <div className="ec-h">
          <span className="badge"><CardIcon name={card.icon} /></span>
          <div>
            <span className="eyebrow">Incident{card.mit !== null ? ` · target ${card.mit}` : ""}</span>
            <h3>{card.n}</h3><p>{card.txt}</p>
          </div>
        </div>
      </div>
      {inc?.skip && <p className="empty">Not exposed this time &mdash; {card.onlyTxt}.</p>}
      {inc?.auto && <p className="empty" style={{ color: "var(--good)", fontStyle: "normal" }}>Avoided: {card.autoTxt}.</p>}
      {!inc?.skip && !inc?.auto && card.mit === null && (
        <p className="empty" style={{ color: "var(--bad)", fontStyle: "normal" }}>No roll on this one. The effect is already in your ledger.</p>
      )}
      {!inc?.skip && !inc?.auto && card.mit !== null && !inc?.rolled && (
        <div className="rollbox">
          <Die />
          <div className="calc">
            Mitigation target <b>{card.mit}</b><br />Roll <b>d20 {sgn(mitBonus(t) + mod)}</b>
            {modTxt && <><br /><span style={{ color: "var(--muted)" }}>{modTxt}</span></>}
          </div>
          <button className="btn" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => send({ kind: "rollIncident" })}>Roll to mitigate</button>
        </div>
      )}
      {inc?.rolled && (
        <div className="rollbox">
          <Die value={inc.roll} />
          <div className="calc">
            {inc.roll} {sgn(mitBonus(t) + mod)} = <b>{inc.total}</b> against <b>{card.mit}</b><br />
            <span className={`verdict ${inc.pass ? "ok" : "no"}`}>{inc.pass ? "Mitigated" : "It hit you"}</span>
          </div>
        </div>
      )}
    </>
  );
}

function Release({ t, busy, send }: { t: TeamState; busy: boolean; send: Send }) {
  const list = releasing(t);
  if (!list.length) return <p className="empty">Nothing to release this sprint.</p>;
  if (t.rel?.blocked) {
    return (
      <p className="empty" style={{ color: "var(--bad)", fontStyle: "normal" }}>
        {t.bugs >= 5
          ? "Five bugs. The release train is stopped until the backlog is paid down — nothing ships."
          : "Releases are blocked by this sprint's incident."}
      </p>
    );
  }
  if (!t.rel?.rolled) {
    const buggy = list.filter((b) => b.buggy).length;
    return (
      <div className="rollbox">
        <Die />
        <div className="calc">
          Shipping <b>{list.map((b) => FEATURE_BY_ID[b.id].n).join(", ")}</b><br />
          Target <b>{relTarget(t)}</b> &middot; Roll <b>d20 {sgn(relBonus(t))}</b>{" "}
          <span style={{ color: "var(--faint)" }}>
            (base +2{own(t, "cicd") ? ", CI/CD +3" : ""}{own(t, "retro") ? ", retro +1" : ""}
            {t.bugs ? `, bugs −${t.bugs}` : ""}{buggy ? `, buggy work −${2 * buggy}` : ""})
          </span>
        </div>
        <button className="btn" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => send({ kind: "rollRelease" })}>Roll to release</button>
      </div>
    );
  }
  return (
    <div className="rollbox">
      <Die value={t.rel.roll} />
      <div className="calc">
        {t.rel.roll} {sgn(relBonus(t))} = <b>{t.rel.total}</b> against <b>{t.rel.target}</b><br />
        <span className={`verdict ${t.rel.full ? "ok" : "soft"}`}>
          {t.rel.full ? "Shipped in full" : "Soft launch — 25% of the reward"}
        </span>
      </div>
    </div>
  );
}

function MarketEvent({ t, id, revealed, busy, send }: { t: TeamState; id: string; revealed: boolean; busy: boolean; send: Send }) {
  if (!revealed) return <p className="empty">Waiting for the facilitator to turn the card over.</p>;
  const card = EVENT_BY_ID[id];
  const r = t.eventResolved;
  return (
    <div className="eventcard world">
      <div className="ec-h">
        <span className="badge"><CardIcon name={card.icon} /></span>
        <div><span className="eyebrow">Market event</span><h3>{card.n}</h3><p>{card.txt}</p></div>
      </div>
      <div className="ec-b">
        {r ? (
          <div className="spread">
            <span style={{ fontSize: 14, color: "var(--muted)" }}>{r.w}</span>
            <span className={`delta ${r.d > 0 ? "up" : r.d < 0 ? "down" : "flat"}`} style={{ fontFamily: "var(--mono)", fontSize: 19, fontWeight: 600 }}>
              {r.d === 0 ? "—" : `${sgn(r.d)}k`}{r.f ? ` · +${r.f} finding` : ""}
            </span>
          </div>
        ) : (
          <button className="btn" disabled={busy} onClick={() => send({ kind: "resolveEvent" })}>Resolve for your bank</button>
        )}
      </div>
    </div>
  );
}

function Retro({ t, sprint, busy, send }: { t: TeamState; sprint: number; busy: boolean; send: Send }) {
  const pay = t.retroPay;
  return (
    <>
      <div className="payline">
        <span className="sum mono">
          +{pay ? pay.base : 2}
          {pay && pay.bonus > 0 && <span className="plus"> +{pay.bonus}</span>}
          <span className="unit"> IP</span>
        </span>
        <span className="why">
          {!pay ? <>Two from the retro.</> : (
            <>
              {pay.base} from the retro{pay.base < 2 && " \u2014 the blame storm took one"}
              {pay.bonus > 0
                ? <>, and one more because {pay.reason}.</>
                : sprint < IP_BONUS_FROM_SPRINT
                  ? <>. From sprint {IP_BONUS_FROM_SPRINT} onwards, a sprint that handles its incident &mdash; or
                      ends with no bugs &mdash; pays one more. Never both.</>
                  : <>. No bonus this time: {pay.reason}.</>}
            </>
          )}
        </span>
        <span className="expiry">Spend it. Unspent points are gone when the next sprint starts.</span>
      </div>
      <div className="shop">
        {PRACTICES.map((p) => {
          const owned = own(t, p.id);
          const poor = !owned && t.ip < p.ip;
          return (
            <button
              key={p.id} className={`pcard ${owned ? "owned" : ""} ${poor ? "poor" : ""}`}
              disabled={busy || owned || poor}
              onClick={() => send({ kind: "buy", practice: p.id })}
            >
              <span className="ph"><span className="pn">{p.n}</span><span className="cost">{owned ? "owned" : `${p.ip} IP`}</span></span>
              <span className="eff">{p.e}</span>
              <span className="src">{p.src}</span>
            </button>
          );
        })}
      </div>
      <p className="calc" style={{ marginTop: 14 }}>
        {t.bugs ? <>Bugs carried into the next sprint: <b>{t.bugs}</b>. </> : "No open bugs. "}
        {t.findings ? <>Open findings: <b>{t.findings}</b>.</> : "No open findings."}
      </p>
    </>
  );
}

function TeamDebrief({ name, t }: { name: string; t: TeamState }) {
  return (
    <>
      <header className="tbar"><div className="tbar-in">
        <span className="nm"><span className="dot" style={{ background: "var(--accent)" }} />{name}</span>
        <div className="tsplit">
          <ThemeSwitch />
          <Link className="btn sm" href="/">Home</Link>
        </div>
      </div></header>
    <main className="solo" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
      <div className="panel">
        <div className="panel-head"><div><h2>{name} &mdash; final position</h2><p>The room&rsquo;s standings are on the projector.</p></div></div>
        <div className="panel-body">
          <div className="podium">
            <div className="prow first">
              <span className="rank">&mdash;</span>
              <span>
                <span className="nm">{name}</span>
                <span className="sub">{t.shipped} shipped &middot; {t.bugs} bugs &middot; {t.findings} findings &middot; {t.practices.length} practices</span>
              </span>
              <span className="tot">{t.customers}k</span>
            </div>
          </div>
          <p className="eyebrow" style={{ marginBottom: 8 }}>What you built</p>
          <div className="chips" style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 10 }}>
            {t.portfolio.length
              ? t.portfolio.map((f) => <span key={f} className="chip">{FEATURE_BY_ID[f].n}</span>)
              : <span className="empty">Nothing reached production.</span>}
          </div>
          <p className="eyebrow" style={{ margin: "18px 0 8px" }}>How you worked</p>
          <div className="chips" style={{ border: "1px solid var(--line)", borderRadius: 9, padding: 10 }}>
            {t.practices.length
              ? t.practices.map((p) => <span key={p} className="chip on">{PRACTICE_BY_ID[p].n}</span>)
              : <span className="empty">You never invested in a practice.</span>}
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
