"use client";

import { useEffect, useRef, useState } from "react";
import { FEATURE_BY_ID, PHASES, type Phase } from "@/lib/cards";
import { capacity, devBonus, legacyDrag, mitBonus, relBonus } from "@/lib/rules";
import type { TeamState } from "@/lib/types";

export const sgn = (n: number) => (n > 0 ? "+" : "") + n;

export function Stepper({ phase }: { phase: number }) {
  return (
    <nav className="stepper" aria-label="Sprint phases">
      <div className="stepper-in">
        {PHASES.map((p, i) => (
          <div key={p.id} className={`step ${i < phase ? "done" : i === phase ? "now" : ""}`}>
            <em>{i + 1}</em>
            <b>{p.n}</b>
          </div>
        ))}
      </div>
    </nav>
  );
}

export function PhaseHead({ phase, extra }: { phase: Phase; extra?: React.ReactNode }) {
  return (
    <div className="panel-head">
      <div style={{ flex: "1 1 320px" }}>
        <h2>{phase.n}</h2>
        <p>{phase.lead}</p>
      </div>
      {extra}
    </div>
  );
}

export function TeachingNote({ phase }: { phase: Phase }) {
  return (
    <div className="note">
      <span className="eyebrow">Teaching point &middot; {phase.note[0]}</span>
      <p>{phase.note[1]}</p>
    </div>
  );
}

/**
 * The three formulas, on screen in every phase. Nobody in a lecture hall has
 * read the rules; the line that matters right now is highlighted.
 */
/** Which formula the current phase is about. Planning is already aiming at the Development roll. */
const HIGHLIGHT: Record<Phase["id"], string> = {
  planning: "dev", dev: "dev", incident: "incident", release: "release", market: "", retro: "retro",
};

const CHEAT_KEY = "nbs.cheat.open";

export function CheatSheet({ t, phase, alwaysOpen = false }: { t?: TeamState; phase: Phase; alwaysOpen?: boolean }) {
  // Closed on arrival; the formulas are reference, the status line below is not.
  // Starting closed also keeps the server and the first client render in step.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { setOpen(localStorage.getItem(CHEAT_KEY) === "1"); } catch { /* private mode */ }
  }, []);
  function toggle(next: boolean) {
    setOpen(next);
    try { localStorage.setItem(CHEAT_KEY, next ? "1" : "0"); } catch { /* private mode */ }
  }

  const drag = t ? legacyDrag(t) : 0;
  const rows: { k: string; id: string; f: React.ReactNode }[] = [
    {
      k: "Develop", id: "dev",
      f: <>d20 + <b>Dev</b> &ge; sum of the targets you picked{drag > 0 ? <> + <b>{drag}</b> legacy drag</> : null} &mdash; all or nothing</>,
    },
    {
      k: "Mitigate", id: "incident",
      f: <>d20 + <b>Mit</b> &ge; the incident&rsquo;s target</>,
    },
    {
      k: "Release", id: "release",
      f: <>d20 + <b>Rel</b> &minus; bugs &minus; 2 per buggy feature &ge; sum of the release targets &mdash; miss it and everything soft-launches at 25%</>,
    },
    {
      k: "Debt", id: "retro",
      f: <>5 bugs &rarr; nothing ships &nbsp;&middot;&nbsp; 3 findings &rarr; one slot less</>,
    },
  ];
  return (
    <div className="cheat">
      <details open={alwaysOpen || open} onToggle={(e) => { if (!alwaysOpen) toggle((e.currentTarget as HTMLDetailsElement).open); }}>
        <summary style={alwaysOpen ? { pointerEvents: "none" } : undefined}>
          <span className="eyebrow">Cheat sheet</span>
          {!alwaysOpen && <span className="hintword">{open ? "hide" : "the three rolls"}</span>}
        </summary>
        <ul>
          {rows.map((r) => (
            <li key={r.id} className={r.id === HIGHLIGHT[phase.id] ? "on" : ""}>
              <span className="k">{r.k}</span>
              <span className="f">{r.f}</span>
            </li>
          ))}
        </ul>
      </details>
      {t && (
        <div className="state">
          <span>Dev <b>{sgn(devBonus(t))}</b></span>
          <span>Mit <b>{sgn(mitBonus(t))}</b></span>
          <span>Rel <b>{sgn(relBonus(t))}</b></span>
          <span>Slots <b>{capacity(t)}</b></span>
          <span>Bugs <b className={t.bugs >= 5 ? "crit" : t.bugs >= 3 ? "warn" : ""}>{t.bugs}</b></span>
          <span>Findings <b className={t.findings >= 3 ? "crit" : t.findings >= 2 ? "warn" : ""}>{t.findings}</b></span>
          {drag > 0 && <span>Legacy drag <b className="warn">+{drag}</b></span>}
          <span>IP <b>{t.ip}</b></span>
        </div>
      )}
    </div>
  );
}

export function FeatureCard({
  id, on = false, disabled = false, onPick,
}: { id: string; on?: boolean; disabled?: boolean; onPick?: (id: string) => void }) {
  const f = FEATURE_BY_ID[id];
  const inner = (
    <>
      <span className="tagrow">
        <span className={`tag ${f.c}`}>{f.c}</span>
        <span className="mono" style={{ fontSize: "10.5px", color: "var(--faint)" }}>
          {f.s} slot{f.s > 1 ? "s" : ""}
        </span>
      </span>
      <span className="ttl">{f.n}</span>
      {f.src && <span className="src">{f.src}</span>}
      <span className="blurb">{f.b}</span>
      {f.bonus && (
        <span className="bonus">
          {[
            f.bonus.dev ? `Dev +${f.bonus.dev}` : null,
            f.bonus.rel ? `Rel +${f.bonus.rel}` : null,
            f.bonus.mit ? `Mit +${f.bonus.mit}` : null,
          ].filter(Boolean).join("  ")}{"  forever"}
        </span>
      )}
      <span className="stats">
        <span><span className="dt">Dev</span><span className="dd">{f.t}</span></span>
        <span><span className="dt">Rel</span><span className="dd">{f.r}</span></span>
        <span><span className="dt">Users</span><span className="dd">{f.k}k</span></span>
        <span><span className="dt">Cost</span><span className="dd">{f.s}</span></span>
      </span>
    </>
  );
  if (!onPick) return <div className="fcard" style={{ cursor: "default" }}>{inner}</div>;
  return (
    <button className="fcard" aria-pressed={on} disabled={disabled} onClick={() => onPick(f.id)}>
      {inner}
    </button>
  );
}

export function Die({ value }: { value?: number }) {
  const [shake, setShake] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value !== undefined && value !== prev.current) {
      setShake(true);
      const id = setTimeout(() => setShake(false), 420);
      prev.current = value;
      return () => clearTimeout(id);
    }
    prev.current = value;
  }, [value]);
  return <div className={`die${shake ? " rolling" : ""}`}>{value ?? "—"}</div>;
}

export function Timer({ minutes }: { minutes: number }) {
  const [left, setLeft] = useState(minutes * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => { setLeft(minutes * 60); setRunning(false); }, [minutes]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => { if (left === 0) setRunning(false); }, [left]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className="timer">
      <output className={`mono${left <= 30 ? " low" : ""}`}>{mm}:{ss}</output>
      <button className="btn ghost sm" onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Start"}</button>
      <button className="btn ghost sm" onClick={() => { setRunning(false); setLeft(minutes * 60); }}>Reset</button>
    </div>
  );
}

export function ErrorBar({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div className="announce" style={{ borderColor: "var(--bad)", background: "var(--bad-soft)", margin: "0 0 14px" }}>
      <span className="eyebrow" style={{ color: "var(--bad)" }}>That did not work</span>
      <p>{message} <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={onDismiss}>Dismiss</button></p>
    </div>
  );
}
