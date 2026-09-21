"use client";

import { useEffect, useRef, useState } from "react";
import { FEATURE_BY_ID, PHASES, type Phase } from "@/lib/cards";

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
