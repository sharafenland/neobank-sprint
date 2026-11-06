"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BOTS, BOT_KINDS } from "@/lib/bots";
import { createSession, writeToken } from "@/lib/client";
import { DEFAULT_SLOTS, SLOT_CHOICES } from "@/lib/rules";
import { ThemeSwitch } from "@/components/ThemeSwitch";

/**
 * One player, one device: it hosts the session and plays the only human bank
 * in it, so it keeps both keys. Rivals, if any, are bots.
 */
export default function SoloSetup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sprints, setSprints] = useState(6);
  const [slots, setSlots] = useState<number>(DEFAULT_SLOTS);
  const [bots, setBots] = useState(3);
  const [teaching, setTeaching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { code, hostToken, teamToken } = await createSession({
        sprints, slots, teaching, bots, solo: true, name: name.trim() || "Your bank",
      });
      writeToken("host", code, hostToken);
      if (teamToken) writeToken("team", code, teamToken);
      router.push(`/play/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the game.");
      setBusy(false);
    }
  }

  return (
    <div className="setup">
      <div className="spread" style={{ marginBottom: 6 }}>
        <p className="eyebrow" style={{ margin: 0 }}>Solo game</p>
        <ThemeSwitch />
      </div>
      <h1 style={{ fontSize: 30, marginTop: 4 }}>Run a neobank on your own</h1>

      <div className="field">
        <span className="lbl">Your bank</span>
        <input
          type="text" value={name} maxLength={22} placeholder="Your bank" autoComplete="off" aria-label="Your bank's name"
          onChange={(e) => setName(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      <div className="field">
        <span className="lbl">Rivals</span>
        <div className="seg" role="group" aria-label="Rivals">
          {[0, 1, 2, 3].map((n) => (
            <button key={n} aria-pressed={bots === n} onClick={() => setBots(n)}>
              {n === 0 ? "None · play for a medal" : `${n} bot${n === 1 ? "" : "s"}`}
            </button>
          ))}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--muted)", maxWidth: "62ch" }}>
          {bots === 0
            ? "No standings to fight over. At the end your customers are measured against what simple strategies reach on decks like yours: bronze, silver or gold."
            : BOT_KINDS.slice(0, bots).map((k) => `${BOTS[k].name}: ${BOTS[k].blurb}`).join(" ")}
        </p>
      </div>

      <div className="field">
        <span className="lbl">Sprints</span>
        <div className="seg" role="group" aria-label="Number of sprints">
          {[3, 4, 6, 8].map((n) => (
            <button key={n} aria-pressed={sprints === n} onClick={() => setSprints(n)}>{n}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="lbl">Slots per sprint</span>
        <div className="seg" role="group" aria-label="Slots per sprint">
          {SLOT_CHOICES.map((n) => (
            <button key={n} aria-pressed={slots === n} onClick={() => setSlots(n)}>
              {n}{n === DEFAULT_SLOTS ? " · standard" : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="lbl">Lecture notes</span>
        <div className="seg" role="group" aria-label="Lecture notes">
          <button aria-pressed={!teaching} onClick={() => setTeaching(false)}>Off</button>
          <button aria-pressed={teaching} onClick={() => setTeaching(true)}>On &middot; for the FSE course</button>
        </div>
      </div>

      {error && <p style={{ color: "var(--bad)", fontSize: 13.5 }}>{error}</p>}

      <div className="field row">
        <button className="btn" style={{ padding: "11px 22px", fontSize: 15 }} disabled={busy} onClick={start}>
          {busy ? "Starting…" : "Start the game"}
        </button>
      </div>

      <p style={{ marginTop: 18, fontSize: 13, color: "var(--muted)", maxWidth: "62ch" }}>
        You set the pace: each phase moves on when you press Continue, and incident and market cards turn over by
        themselves. This browser holds the key to the game &mdash; close the tab and come back to the same address
        to pick it up again.
      </p>
    </div>
  );
}
