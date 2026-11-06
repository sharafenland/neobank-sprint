"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EVENT_BY_ID, FEATURE_BY_ID, INCIDENT_BY_ID, PHASES, PRACTICES, PRACTICE_BY_ID } from "@/lib/cards";
import { act, hostOp, type View } from "@/lib/client";
import { medals } from "@/lib/bots";
import { INCIDENT_FX, incidentParts } from "@/lib/effects";
import {
  BUG_WALL, FIX_PER_SLOT, INFRA_CAP, canPush, has, mitBonus, relBonus, IP_BONUS_FROM_SPRINT, capacity, cardDevTarget, devBonus, devTarget, infraBonus, legacyDrag,
  avgRoll, canAffordAny, cartCost, devParts, maxFixSlots, mitParts, onShelf, own, relParts, relTarget, releasing, shelvedTarget,
  sumParts, usedSlots,
} from "@/lib/rules";
import type { TeamState } from "@/lib/types";
import { useGame } from "@/components/useGame";
import { CardIcon } from "@/components/CardIcon";
import { BotTag, Breakdown, CheatSheet, Die, ErrorBar, FeatureCard, PhaseHead, Stepper, TeachingNote, sgn } from "@/components/ui";
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
  // Solo: this device is the host as well as the only human bank.
  const solo = view.isHost && s.solo;
  const meDone = !!view.teams.find((x) => x.name === view.you!.name)?.phaseDone;

  async function advance() {
    setBusy(true);
    setActionError(null);
    try {
      await hostOp(code, "next");
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

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

  if (s.finished) return <TeamDebrief name={view.you.name} t={t} view={view} />;

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
              {phase.id === "planning" && <Planning t={t} market={view.market} lecture={s.teaching} busy={busy} send={send} />}
              {phase.id === "dev" && <Development t={t} busy={busy} send={send} />}
              {phase.id === "incident" && <Incident t={t} id={view.incidentId} revealed={s.reveal_incident} busy={busy} send={send} />}
              {phase.id === "release" && <Release t={t} busy={busy} send={send} />}
              {phase.id === "market" && <MarketEvent t={t} id={view.eventId} revealed={s.reveal_event} busy={busy} send={send} />}
              {phase.id === "retro" && <Retro t={t} sprint={s.sprint} lecture={s.teaching} busy={busy} send={send} />}
            </div>
          </div>
        </div>

        <aside className="rail">
          <CheatSheet t={t} phase={phase} />
          {solo && s.teaching && <TeachingNote phase={phase} />}
          {view.teams.length > 1 && <Standings view={view} me={view.you.name} />}
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
            {(t.shelf ?? []).length > 0 && (
              <div className="chips" style={{ borderTop: "1px solid var(--line)" }}>
                {t.shelf.map((f) => <span key={f} className="chip" style={{ borderStyle: "dashed" }}>Shelved: {FEATURE_BY_ID[f].n}</span>)}
              </div>
            )}
            {t.practices.length === 0 && t.portfolio.length === 0 && (t.shelf ?? []).length === 0 && (
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
          {meDone ? (solo ? "Done. Continue when you are ready." : "Done. The facilitator moves the room on.") : phase.lead}
        </span>
        {solo ? (
          <button className="btn" disabled={busy || !meDone} onClick={advance}>
            {phase.id === "retro"
              ? (s.sprint >= s.sprints ? "Finish and see the results" : `Start sprint ${s.sprint + 1}`)
              : `Continue to ${PHASES[s.phase + 1].n}`}
          </button>
        ) : (
          <span className="mono" style={{ fontSize: 12.5, color: "var(--faint)" }}>Code {s.code}</span>
        )}
      </div></div>
    </>
  );
}

type Send = (action: unknown) => Promise<void>;

function Planning({ t, market, lecture, busy, send }: { t: TeamState; market: string[]; lecture: boolean; busy: boolean; send: Send }) {
  const cap = capacity(t);
  const used = usedSlots(t);
  const card = (id: string) => {
    const on = t.picked.includes(id);
    const owned = has(t, id);
    const size = FEATURE_BY_ID[id].s;
    const tooBig = size > cap;
    const noRoom = !tooBig && used + size > cap;
    return (
      <FeatureCard
        key={id} id={id} on={on} shelved={onShelf(t, id)} lecture={lecture}
        disabled={busy || (!on && (t.confirmed || owned || tooBig || noRoom))}
        reason={
          owned ? "Already in your portfolio — nobody builds the same thing twice."
          : on || t.confirmed ? undefined
            : tooBig
              ? (!own(t, "crossfn") && size <= cap + 1 && t.findings < 3
                ? `Takes ${size} slots. Cross-Functional Team buys you one more.`
                : `Takes ${size} slots — more than you have this sprint.`)
            : noRoom ? "No slots left this sprint."
            : undefined
        }
        onPick={(f) => send({ kind: "pick", feature: f })}
      />
    );
  };
  // A shelved card still on the table is shown there, once, carrying its discount.
  const shelfOnly = (t.shelf ?? []).filter((id) => !market.includes(id));
  return (
    <>
      {t.findings >= 3 && (
        <p style={{ margin: "0 0 12px", color: "var(--bad)", fontSize: 13.5 }}>
          Three open findings. The supervisor has withheld one of your slots until you clear them.
        </p>
      )}
      <RollPreview t={t} />
      <div className="market">{market.map(card)}</div>
      {shelfOnly.length > 0 && (
        <>
          <p className="eyebrow" style={{ margin: "18px 0 8px" }}>Your shelf &mdash; half the Dev target, full slots</p>
          <div className="market">{shelfOnly.map(card)}</div>
        </>
      )}
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

/** Chance of meeting `need` or more on a d20. */
const odds = (need: number) => Math.round(Math.min(1, Math.max(0, (21 - need) / 20)) * 100);

/**
 * The three modifiers as they will stand when the dice come out, so a plan can
 * be sized against them. Remediation chosen in this plan resolves before any
 * roll, so the preview already counts it.
 */
function RollPreview({ t }: { t: TeamState }) {
  const fix = t.fix ?? { bugs: 0, findings: 0 };
  const after: TeamState = {
    ...t,
    bugs: Math.max(0, t.bugs - fix.bugs * FIX_PER_SLOT.bugs),
    findings: Math.max(0, t.findings - fix.findings * FIX_PER_SLOT.findings),
  };
  const dev = devBonus(after);
  const rel = relBonus(after);
  const mit = mitBonus(after);
  const picked = t.picked.length > 0;
  const devNeed = devTarget(t) - dev;
  const relNeed = t.picked.reduce((a, id) => a + FEATURE_BY_ID[id].r, 0) - rel;
  // A pushed card adds its bugs and another −2 for being in the release; Definition of Done removes both.
  const pushCost = own(t, "dod") ? 0 : own(t, "agentic") ? 4 : 3;
  const col = (k: string, bonus: number, parts: ReturnType<typeof devParts>, foot: React.ReactNode) => (
    <div className="rp-col">
      <div className="rp-h"><span className="eyebrow">{k}</span><b className="mono">d20 {sgn(bonus)}</b></div>
      <Breakdown parts={parts} />
      {foot && <div className="rp-foot">{foot}</div>}
    </div>
  );
  return (
    <div className="rollpreview" aria-label="Your roll modifiers this sprint">
      {col("Development", dev, devParts(after), picked
        ? <>This plan needs <b>{Math.max(1, devNeed)}+</b> on the die &middot; {odds(devNeed)}%</>
        : "Pick cards to see what this plan needs.")}
      {col("Release", rel, relParts(after), picked
        ? <>If built cleanly: <b>{Math.max(1, relNeed)}+</b> &middot; {odds(relNeed)}%. {pushCost ? <> Each card pushed through costs another &minus;{pushCost}.</> : null}</>
        : null)}
      {col("Mitigation", mit, mitParts(after), "Against this sprint’s incident; the card may add its own modifier.")}
    </div>
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
      {t.bugs >= BUG_WALL && (
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
          Target <b>{devTarget(t)}</b> = {t.picked.map((id) => cardDevTarget(t, id) + (onShelf(t, id) ? " (shelved)" : "")).join(" + ")}
          {legacyDrag(t) > 0 ? ` + ${legacyDrag(t)} legacy drag` : ""}
          {own(t, "modular") && t.picked.length >= 2 ? " − 3" : ""}<br />
          Roll <b>d20 {sgn(devBonus(t))}</b>
          <Breakdown parts={devParts(t)} />
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
          {t.dev.roll} {sgn(t.dev.total - t.dev.roll)} = <b>{t.dev.total}</b> against <b>{t.dev.target}</b><br />
          <span className={`verdict ${t.dev.pass ? "ok" : "no"}`}>{t.dev.pass ? "Everything built" : "Missed the bar"}</span>
          <Breakdown parts={t.dev.parts} />
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
                    <button className="btn sm danger" disabled={busy || !canPush(t)} onClick={() => send({ kind: "decide", feature: id, how: "push" })}
                      title={canPush(t) ? undefined : `At ${BUG_WALL} bugs nothing more can be pushed through.`}>
                      {!canPush(t) ? `Push through (blocked at ${BUG_WALL} bugs)`
                        : <>Push through {own(t, "dod") ? "(no bug)" : own(t, "agentic") ? "(+2 bugs)" : "(+1 bug)"}</>}
                    </button>
                    <button className="btn sm ghost" disabled={busy} onClick={() => send({ kind: "decide", feature: id, how: "shelve" })}>
                      Shelve (Dev {shelvedTarget(id)} next time{own(t, "flags") ? ", 20% via flags" : ""})
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
  const parts = [...mitParts(t), ...incidentParts(spec, t)];
  const inc = t.inc;

  return (
    <>
      <div className="eventcard risk" style={{ marginBottom: 14 }}>
        <div className="ec-h">
          <span className="badge"><CardIcon name={card.icon} /></span>
          <div>
            <span className="eyebrow">{card.mit !== null ? `Mitigation target ${card.mit}` : "No roll"}</span>
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
            Mitigation target <b>{card.mit}</b><br />Roll <b>d20 {sgn(sumParts(parts))}</b>
            <Breakdown parts={parts} />
          </div>
          <button className="btn" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => send({ kind: "rollIncident" })}>Roll to mitigate</button>
        </div>
      )}
      {inc?.rolled && (
        <div className="rollbox">
          <Die value={inc.roll} />
          <div className="calc">
            {inc.roll} {sgn(inc.total! - inc.roll!)} = <b>{inc.total}</b> against <b>{card.mit}</b><br />
            <span className={`verdict ${inc.pass ? "ok" : "no"}`}>{inc.pass ? "Mitigated" : "It hit you"}</span>
            <Breakdown parts={inc.parts} />
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
        {t.bugs >= BUG_WALL
          ? "Five bugs. The release train is stopped until the backlog is paid down — nothing ships."
          : "Releases are blocked by this sprint's incident."}
      </p>
    );
  }
  if (!t.rel?.rolled) {
    const parts = relParts(t);
    return (
      <div className="rollbox">
        <Die />
        <div className="calc">
          Shipping <b>{list.map((b) => FEATURE_BY_ID[b.id].n).join(", ")}</b><br />
          Target <b>{relTarget(t)}</b> &middot; Roll <b>d20 {sgn(sumParts(parts))}</b>
          <Breakdown parts={parts} />
        </div>
        <button className="btn" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => send({ kind: "rollRelease" })}>Roll to release</button>
      </div>
    );
  }
  return (
    <div className="rollbox">
      <Die value={t.rel.roll} />
      <div className="calc">
        {t.rel.roll} {sgn(t.rel.total! - t.rel.roll!)} = <b>{t.rel.total}</b> against <b>{t.rel.target}</b><br />
        <span className={`verdict ${t.rel.full ? "ok" : "soft"}`}>
          {t.rel.full ? "Shipped in full" : "Soft launch — 25% of the reward"}
        </span>
        <Breakdown parts={t.rel.parts} />
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
        <div><h3>{card.n}</h3><p>{card.txt}</p></div>
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

function Retro({ t, sprint, lecture, busy, send }: { t: TeamState; sprint: number; lecture: boolean; busy: boolean; send: Send }) {
  const pay = t.retroPay;
  const cart = t.retroCart ?? [];
  const bought = t.retroBought ?? [];
  const left = t.ip - cartCost(t);
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
          const fresh = bought.includes(p.id);
          const picked = cart.includes(p.id);
          const poor = !owned && !picked && left < p.ip;
          return (
            <button
              key={p.id} className={`pcard ${owned ? "owned" : ""} ${poor ? "poor" : ""}`}
              aria-pressed={picked}
              disabled={busy || owned || poor || t.retroDone}
              onClick={() => send({ kind: "buy", practice: p.id })}
            >
              <span className="ph">
                <span className="pn">{p.n}</span>
                <span className="cost">{fresh ? "bought" : owned ? "owned" : picked ? `${p.ip} IP ✓` : `${p.ip} IP`}</span>
              </span>
              <span className="eff">{p.e}</span>
              {lecture && <span className="src">{p.src}</span>}
            </button>
          );
        })}
      </div>
      <div className="spread" style={{ marginTop: 14 }}>
        <p className="calc" style={{ margin: 0 }}>
          {!t.retroDone && cart.length > 0 && <>Selected: <b>{cartCost(t)} IP</b> &middot; left after confirming: <b>{left}</b>. </>}
          {t.bugs ? <>Bugs carried into the next sprint: <b>{t.bugs}</b>. </> : "No open bugs. "}
          {t.findings ? <>Open findings: <b>{t.findings}</b>.</> : "No open findings."}
        </p>
        {t.retroDone ? (
          <span className="row" style={{ alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>
              {bought.length
                ? <>Confirmed: {bought.map((id) => PRACTICE_BY_ID[id].n).join(", ")}.</>
                : <>Confirmed &mdash; nothing bought.</>}
              {t.ip > 0 ? ` ${t.ip} IP will expire.` : ""}
            </span>
            <button className="btn ghost sm" disabled={busy} onClick={() => send({ kind: "reopenRetro" })}>Change my mind</button>
          </span>
        ) : !cart.length && !canAffordAny(t) ? (
          <span className="mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>Nothing left you can afford.</span>
        ) : (
          <button className="btn" disabled={busy} onClick={() => send({ kind: "confirmRetro" })}>
            {cart.length
              ? `Confirm ${cart.length} practice${cart.length === 1 ? "" : "s"} (${cartCost(t)} IP)`
              : `Confirm — buy nothing (${t.ip} IP expire)`}
          </button>
        )}
      </div>
    </>
  );
}

/** The room's standings, for a group playing against bots or other groups. */
function Standings({ view, me }: { view: View; me: string }) {
  const ranked = [...view.teams].sort((a, b) => b.customers - a.customers);
  return (
    <div className="ledger">
      <div className="ledger-h"><span className="dot" style={{ background: "var(--accent)" }} /><b>Standings</b></div>
      <ol className="standings">
        {ranked.map((x, i) => (
          <li key={x.name} className={x.name === me ? "me" : ""}>
            <span className="mono rank">{i + 1}</span>
            <span className="nm">{x.name}<BotTag kind={x.bot} /></span>
            <span className="mono">{x.customers}k</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Without rivals, a solo game is measured against what the bots reach on decks like it. */
function MedalLine({ customers, sprints, slots }: { customers: number; sprints: number; slots: number }) {
  const m = useMemo(() => medals(sprints, slots), [sprints, slots]);
  const won = customers >= m.gold ? "Gold" : customers >= m.silver ? "Silver" : customers >= m.bronze ? "Bronze" : null;
  return (
    <div className="announce" style={{ margin: "0 0 18px" }}>
      <span className="eyebrow">{won ? `${won} medal` : "No medal this time"}</span>
      <p>
        Bronze {m.bronze}k &middot; silver {m.silver}k &middot; gold {m.gold}k &mdash; what simple bot strategies
        reach in a typical, a good and a top-tenth game of {sprints} sprints with {slots} slot{slots === 1 ? "" : "s"}.
        {won ? "" : " Play it again: the deck will be different."}
      </p>
    </div>
  );
}

function TeamDebrief({ name, t, view }: { name: string; t: TeamState; view: View }) {
  const ranked = [...view.teams].sort((a, b) => b.customers - a.customers);
  const rivals = ranked.length > 1;
  return (
    <>
      <header className="tbar"><div className="tbar-in">
        <span className="nm"><span className="dot" style={{ background: "var(--accent)" }} />{name}</span>
        <div className="tsplit">
          <ThemeSwitch />
          {view.session.solo && <Link className="btn ghost sm" href="/solo">New solo game</Link>}
          <Link className="btn sm" href="/">Home</Link>
        </div>
      </div></header>
    <main className="solo" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
      <div className="panel">
        <div className="panel-head"><div><h2>{name} &mdash; final position</h2><p>{view.session.solo ? "Customers in thousands." : "The room\u2019s standings are on the facilitator\u2019s screen."}</p></div></div>
        <div className="panel-body">
          {!rivals && view.session.solo && (
            <MedalLine customers={t.customers} sprints={view.session.sprints} slots={view.session.slots ?? 2} />
          )}
          {rivals && (
            <div className="podium">
              {ranked.map((x, i) => (
                <div key={x.name} className={`prow ${x.name === name ? "first" : ""}`}>
                  <span className="rank">{i + 1}</span>
                  <span>
                    <span className="nm">{x.name}<BotTag kind={x.bot} /></span>
                    <span className="sub">
                      {x.shipped} features released &middot; avg. roll {x.avgRoll === null ? "\u2014" : x.avgRoll.toFixed(1)}
                      {" "}&middot; {x.bugs} bugs &middot; {x.practices.length} practices
                    </span>
                  </span>
                  <span className="tot">{x.customers}k</span>
                </div>
              ))}
            </div>
          )}
          {!rivals && <div className="podium">
            <div className="prow first">
              <span className="rank">&mdash;</span>
              <span>
                <span className="nm">{name}</span>
                <span className="sub">
                  {t.shipped} features released &middot; avg. roll {avgRoll(t) === null ? "\u2014" : avgRoll(t)!.toFixed(1)}
                  {" "}(a fair die: 10.5) &middot; {t.bugs} bugs &middot; {t.findings} findings &middot; {t.practices.length} practices</span>
              </span>
              <span className="tot">{t.customers}k</span>
            </div>
          </div>}
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
