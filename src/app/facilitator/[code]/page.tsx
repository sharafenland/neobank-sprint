"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { EVENT_BY_ID, INCIDENT_BY_ID, PHASES, PRACTICES } from "@/lib/cards";
import { hostOp } from "@/lib/client";
import { useGame } from "@/components/useGame";
import { CheatSheet, ErrorBar, FeatureCard, PhaseHead, Stepper, TeachingNote, Timer } from "@/components/ui";

export default function Facilitator() {
  const code = String(useParams().code ?? "").toUpperCase();
  const { view, error, refresh } = useGame(code);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!view) return <div className="setup"><p className="empty">{error ?? "Loading the session…"}</p></div>;
  if (!view.isHost) {
    return (
      <div className="setup">
        <h1 style={{ fontSize: 26 }}>This browser is not the facilitator</h1>
        <p className="lede" style={{ fontSize: 15 }}>
          The facilitator key for <b>{code}</b> lives in the browser that created the session. Open this page there,
          or create a new session and write the new code on the board.
        </p>
      </div>
    );
  }

  const s = view.session;
  const phase = PHASES[s.phase];

  async function run(op: "next" | "back" | "revealIncident" | "revealEvent") {
    try {
      setActionError(null);
      await hostOp(code, op);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not reach the server.");
    }
  }

  if (s.finished) return <Debrief view={view} />;

  return (
    <>
      <header className="topbar"><div className="topbar-in">
        <div className="brand"><b>Neobank Sprint</b><span>Facilitator</span></div>
        <span className="sprintchip">Sprint {s.sprint} / {s.sprints}</span>
        <Timer minutes={phase.minutes} />
      </div></header>

      <Stepper phase={s.phase} />

      <main className="desk">
        <div>
          <ErrorBar message={actionError ?? error} onDismiss={() => setActionError(null)} />

          <div className="codebox" style={{ marginBottom: 16 }}>
            <div><div className="lab">Access code</div><div className="val">{s.code}</div></div>
            <div className="side">{view.teams.length} group{view.teams.length === 1 ? "" : "s"} joined<br />{s.sprints} sprints</div>
          </div>

          <div className="panel">
            <PhaseHead phase={phase} />
            <div className="panel-body">
              <CheatSheet phase={phase} />
              {phase.id === "planning" && (
                <>
                  <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 13.5 }}>
                    Six cards on the table &mdash; three product, three platform. One of each rotates out at the end
                    of the sprint, picked or not. Platform cards earn few customers and pay a permanent modifier
                    instead; a group that only ships product picks up legacy drag on every later Development roll.
                  </p>
                  <div className="market">{view.market.map((id) => <FeatureCard key={id} id={id} />)}</div>
                </>
              )}

              {phase.id === "dev" && (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 13.5 }}>
                  Each group rolls one d20 plus its Dev bonus against the summed targets of everything it picked.
                  All or nothing. On a miss they choose per feature: push it through and take the bug, or shelve it.
                </p>
              )}

              {phase.id === "incident" && (
                s.reveal_incident ? (
                  <div className="eventcard risk">
                    <div className="ec-h">
                      <span className="eyebrow">
                        Incident{INCIDENT_BY_ID[view.incidentId].mit !== null
                          ? ` · mitigation target ${INCIDENT_BY_ID[view.incidentId].mit}`
                          : " · no roll, it just happens"}
                      </span>
                      <h3>{INCIDENT_BY_ID[view.incidentId].n}</h3>
                      <p>{INCIDENT_BY_ID[view.incidentId].txt}</p>
                    </div>
                  </div>
                ) : (
                  <button className="btn" style={{ padding: "11px 22px", fontSize: 15 }} onClick={() => run("revealIncident")}>
                    Reveal this sprint&rsquo;s incident
                  </button>
                )
              )}

              {phase.id === "release" && (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 13.5 }}>
                  d20 plus the Release bonus, minus the bug count, minus 2 for each buggy feature in the batch.
                  Anyone at five bugs is not shipping at all &mdash; the scoreboard on the right shows who.
                </p>
              )}

              {phase.id === "market" && (
                s.reveal_event ? (
                  <div className="eventcard world">
                    <div className="ec-h">
                      <span className="eyebrow">Market event</span>
                      <h3>{EVENT_BY_ID[view.eventId].n}</h3>
                      <p>{EVENT_BY_ID[view.eventId].txt}</p>
                    </div>
                    {EVENT_BY_ID[view.eventId].needsCall && (
                      <div className="ec-b">
                        <div className="announce" style={{ marginTop: 0 }}>
                          <span className="eyebrow">Resolved from the live standings</span>
                          <p>
                            This card depends on who is ahead. The server reads the scoreboard, so you do not have to
                            announce anything &mdash; but it is worth saying out loud who {EVENT_BY_ID[view.eventId].needsCall} is.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button className="btn" style={{ padding: "11px 22px", fontSize: 15 }} onClick={() => run("revealEvent")}>
                    Reveal this sprint&rsquo;s market event
                  </button>
                )
              )}

              {phase.id === "retro" && (
                <>
                  <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 13.5 }}>
                    +2 Investment Points each. Twelve practices are available; every card names the session it comes from.
                  </p>
                  <div className="shop">
                    {PRACTICES.map((p) => (
                      <div key={p.id} className="pcard" style={{ cursor: "default" }}>
                        <span className="ph"><span className="pn">{p.n}</span><span className="cost">{p.ip} IP</span></span>
                        <span className="eff">{p.e}</span>
                        <span className="src">{p.src}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <TeachingNote phase={phase} />
            </div>
          </div>
        </div>

        <aside className="rail"><Roster view={view} /></aside>
      </main>

      <div className="footbar"><div className="footbar-in">
        <span className="hint">
          {view.teams.length === 0
            ? "Waiting for the first group to join."
            : `${view.teams.filter((t) => t.phaseDone).length} of ${view.teams.length} groups have finished this phase.`}
        </span>
        <button className="btn ghost" disabled={s.phase === 0 && s.sprint === 1} onClick={() => run("back")}>Back</button>
        <button className="btn" onClick={() => run("next")}>
          {phase.id === "retro"
            ? (s.sprint >= s.sprints ? "Finish and debrief" : `Start sprint ${s.sprint + 1}`)
            : `Continue to ${PHASES[s.phase + 1].n}`}
        </button>
      </div></div>
    </>
  );
}

function Roster({ view }: { view: ReturnType<typeof useGame>["view"] & object }) {
  const teams = [...view.teams].sort((a, b) => b.customers - a.customers);
  if (!teams.length) {
    return <div className="panel"><div className="panel-body"><p className="empty">Nobody has joined yet.</p></div></div>;
  }
  return (
    <div className="panel">
      <div className="panel-head" style={{ padding: "13px 16px 11px" }}>
        <div><h2 style={{ fontSize: 16 }}>Live standings</h2><p style={{ fontSize: 12.5 }}>Updates as groups act.</p></div>
      </div>
      <div className="panel-body" style={{ padding: "10px 12px", display: "grid", gap: 8 }}>
        {teams.map((t, i) => (
          <div key={t.name} className="ledger">
            <div className="ledger-h">
              <span className="rank mono" style={{ color: "var(--faint)", fontSize: 13 }}>{i + 1}</span>
              <b>{t.name}</b>
              {t.phaseDone && <span className="tick" style={{ color: "var(--good)", fontFamily: "var(--mono)", fontSize: 11 }}>&#10003;</span>}
              <span className="score">{t.customers}k</span>
            </div>
            <dl className="ledger-g" style={{ margin: 0 }}>
              <div><dt>Bugs</dt><dd className={t.bugs >= 5 ? "crit" : t.bugs >= 3 ? "warn" : ""}>{t.bugs}</dd></div>
              <div><dt>Findings</dt><dd className={t.findings >= 3 ? "crit" : t.findings >= 2 ? "warn" : ""}>{t.findings}</dd></div>
              <div><dt>IP</dt><dd>{t.ip}</dd></div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function Debrief({ view }: { view: NonNullable<ReturnType<typeof useGame>["view"]> }) {
  const ranked = [...view.teams].sort((a, b) => b.customers - a.customers);
  const questions: [string, string][] = [
    ["Which practice would you buy first if we replayed this, and in which sprint?", "Improvement compounds — the answer is usually earlier than it feels."],
    ["Point at the sprint where your bug count started deciding your releases for you.", "Technical debt as an interest payment, not a one-off cost."],
    ["Who skipped a compliance feature to grow faster, and when did that bill arrive?", "Session 10 — regulation as a non-functional requirement with a delay."],
    ["The Development roll was all-or-nothing across everything you picked. What does that argue about sprint scope and batch size?", "Small batches fail smaller and more often, which is the point."],
    ["Which of your losses were dice, and which were the portfolio you chose three sprints earlier?", "Separating variance from strategy — the core of empirical process control."],
    ["Observability, failover and privacy earned almost nothing on release. Would a value-ranked backlog ever have reached them?", "Session 04 — the non-functional half of an architecture."],
  ];
  return (
    <>
      <header className="topbar"><div className="topbar-in">
        <div className="brand"><b>Neobank Sprint</b><span>Debrief</span></div>
        <span className="sprintchip">{view.session.sprints} sprints &middot; code {view.session.code}</span>
      </div></header>
      <main className="desk" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
        <div className="panel">
          <div className="panel-head"><div><h2>Final standings</h2><p>Customers in thousands.</p></div></div>
          <div className="panel-body">
            <div className="podium">
              {ranked.map((t, i) => (
                <div key={t.name} className={`prow ${i === 0 ? "first" : ""}`}>
                  <span className="rank">{i + 1}</span>
                  <span>
                    <span className="nm">{t.name}</span>
                    <span className="sub">{t.bugs} bugs &middot; {t.findings} findings &middot; {t.practices.length} practices</span>
                  </span>
                  <span className="tot">{t.customers}k</span>
                </div>
              ))}
            </div>
            <p className="eyebrow" style={{ marginBottom: 10 }}>Debrief &middot; 15 minutes, in this order</p>
            <ol className="debrief" style={{ padding: 0, margin: 0 }}>
              {questions.map(([q, w]) => <li key={q}>{q}<span>{w}</span></li>)}
            </ol>
          </div>
        </div>
      </main>
    </>
  );
}
