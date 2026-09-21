"use client";

import Link from "next/link";
import { FEATURES, PHASES, PRACTICES } from "@/lib/cards";
import { CheatSheet, FeatureCard } from "@/components/ui";

/** Open on a phone during the game, or put on the projector before it. */
export default function Rules() {
  const product = FEATURES.filter((f) => f.c !== "platform");
  const platform = FEATURES.filter((f) => f.c === "platform");

  return (
    <div className="setup" style={{ maxWidth: 980 }}>
      <p className="eyebrow">Neobank Sprint</p>
      <h1 style={{ fontSize: 30, marginTop: 4 }}>How the game works</h1>
      <div className="rule" />

      <CheatSheet phase={PHASES[0]} alwaysOpen />

      <p style={{ color: "var(--muted)", maxWidth: "62ch" }}>
        Six phases per sprint, the same for every group. The facilitator moves the room on; you decide and roll on
        your own device. Most customers at the end wins.
      </p>

      <ol style={{ listStyle: "none", padding: 0, margin: "22px 0 0", display: "grid", gap: 14 }}>
        {PHASES.map((p, i) => (
          <li key={p.id} className="panel" style={{ padding: "13px 16px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <span className="mono" style={{ color: "var(--accent)", fontSize: 12 }}>{String(i + 1).padStart(2, "0")}</span>
              <h2 style={{ fontSize: 17 }}>{p.n}</h2>
            </div>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13.5 }}>{p.lead}</p>
          </li>
        ))}
      </ol>

      <h2 style={{ fontSize: 21, margin: "30px 0 8px" }}>Two kinds of debt</h2>
      <div className="tablewrap">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "4px 7px", borderBottom: "1px solid var(--line)" }} />
              <th style={{ textAlign: "left", padding: "4px 7px", borderBottom: "1px solid var(--line)" }}>Bugs</th>
              <th style={{ textAlign: "left", padding: "4px 7px", borderBottom: "1px solid var(--line)" }}>Audit findings</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Earned by", "Pushing unfinished work through", "Failed incidents and regulatory cards"],
              ["Taxes", "Every Release roll", "Every Mitigation roll"],
              ["Hard wall", "5 bugs → nothing ships", "3 findings → one slot less capacity"],
              ["Paid down by", "Automated Testing", "Compliance by Design"],
            ].map((row) => (
              <tr key={row[0]}>
                {row.map((cell, i) => (
                  <td key={i} style={{ padding: "5px 7px", borderBottom: "1px solid var(--line)", color: i === 0 ? "var(--faint)" : "var(--ink)" }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 21, margin: "30px 0 4px" }}>Legacy drag</h2>
      <p style={{ margin: 0, color: "var(--muted)", maxWidth: "62ch", fontSize: 13.5 }}>
        One platform card carries two product features. Every product feature past that adds +1 to your combined
        Development target, up to +6. Platform cards earn few customers and pay a permanent modifier instead,
        capped at +4 per category.
      </p>

      <h2 style={{ fontSize: 21, margin: "30px 0 4px" }}>Capacity</h2>
      <p style={{ margin: 0, color: "var(--muted)", maxWidth: "62ch", fontSize: 13.5 }}>
        Two slots a sprint, three with Cross-Functional Team, one fewer while you have three open findings.
        The two migration cards cost three slots on their own &mdash; they are the whole sprint, and you cannot
        take them at all until you have bought the third slot. They stay off the table until that is possible.
        Taking no new work is always allowed.
      </p>

      <h2 style={{ fontSize: 21, margin: "30px 0 8px" }}>Product cards <span className="mono" style={{ fontSize: 13, color: "var(--faint)" }}>{product.length}</span></h2>
      <div className="market">{product.map((f) => <FeatureCard key={f.id} id={f.id} />)}</div>

      <h2 style={{ fontSize: 21, margin: "30px 0 8px" }}>Platform cards <span className="mono" style={{ fontSize: 13, color: "var(--faint)" }}>{platform.length}</span></h2>
      <div className="market">{platform.map((f) => <FeatureCard key={f.id} id={f.id} />)}</div>

      <h2 style={{ fontSize: 21, margin: "30px 0 8px" }}>Agile practices <span className="mono" style={{ fontSize: 13, color: "var(--faint)" }}>{PRACTICES.length}</span></h2>
      <div className="shop">
        {PRACTICES.map((p) => (
          <div key={p.id} className="pcard" style={{ cursor: "default" }}>
            <span className="ph"><span className="pn">{p.n}</span><span className="cost">{p.ip} IP</span></span>
            <span className="eff">{p.e}</span>
            <span className="src">{p.src}</span>
          </div>
        ))}
      </div>

      <p style={{ margin: "30px 0 0" }}><Link className="btn ghost" href="/">Back to the start</Link></p>
    </div>
  );
}
