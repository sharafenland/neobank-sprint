"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSession, writeToken } from "@/lib/client";
import { DEFAULT_SLOTS, SLOT_CHOICES } from "@/lib/rules";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export default function HostSetup() {
  const router = useRouter();
  const [sprints, setSprints] = useState(6);
  const [slots, setSlots] = useState<number>(DEFAULT_SLOTS);
  const [teaching, setTeaching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { code, hostToken } = await createSession(sprints, slots, teaching);
      writeToken("host", code, hostToken);
      router.push(`/facilitator/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the session.");
      setBusy(false);
    }
  }

  return (
    <div className="setup">
      <div className="spread" style={{ marginBottom: 6 }}>
        <p className="eyebrow" style={{ margin: 0 }}>Facilitator setup</p>
        <ThemeSwitch />
      </div>
      <h1 style={{ fontSize: 30, marginTop: 4 }}>Start a session</h1>

      <div className="field">
        <span className="lbl">Sprints</span>
        <div className="seg" role="group" aria-label="Number of sprints">
          {[3, 4, 6, 8].map((n) => (
            <button key={n} aria-pressed={sprints === n} onClick={() => setSprints(n)}>
              {n}
              {n === 4 ? " · 60 min" : n === 6 ? " · 90 min" : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="lbl">Slots per group per sprint</span>
        <div className="seg" role="group" aria-label="Slots per group per sprint">
          {SLOT_CHOICES.map((n) => (
            <button key={n} aria-pressed={slots === n} onClick={() => setSlots(n)}>
              {n}
              {n === DEFAULT_SLOTS ? " · standard" : ""}
            </button>
          ))}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--muted)", maxWidth: "62ch" }}>
          {slots === 1
            ? "Very tight: two-slot cards need Cross-Functional Team, and the three-slot migrations stay out of reach."
            : slots >= 3
              ? "Generous: bigger batches from sprint 1, and the three-slot migrations are takeable as soon as they are dealt."
              : "The balanced default. The three-slot migrations need Cross-Functional Team."}
          {" "}Cross-Functional Team adds one; three open findings take one away.
        </p>
      </div>

      <div className="field">
        <span className="lbl">Lecture notes</span>
        <div className="seg" role="group" aria-label="Lecture notes">
          <button aria-pressed={!teaching} onClick={() => setTeaching(false)}>Off</button>
          <button aria-pressed={teaching} onClick={() => setTeaching(true)}>On &middot; for the FSE course</button>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--muted)", maxWidth: "62ch" }}>
          Teaching points for each phase, the course session on every card, and the lesson behind each debrief
          question. Leave it off unless you are teaching the course. You can switch it from the console at any time.
        </p>
      </div>

      {error && <p style={{ color: "var(--bad)", fontSize: 13.5 }}>{error}</p>}

      <div className="field row">
        <button className="btn" style={{ padding: "11px 22px", fontSize: 15 }} disabled={busy} onClick={start}>
          {busy ? "Creating…" : "Create the session"}
        </button>
      </div>

      <p style={{ marginTop: 18, fontSize: 13, color: "var(--muted)", maxWidth: "62ch" }}>
        You get a four-character code for the board. Keep this browser open &mdash; the facilitator key is stored in it,
        and it is what lets you move the room from one phase to the next.
      </p>
    </div>
  );
}
