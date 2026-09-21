"use client";

/**
 * One stroked set for the incident and market-event cards. Drawn on a 24-grid
 * at a single 1.7 weight so twenty-five of them read as one family, and in
 * currentColor so each card's own tone carries them through both themes.
 */
const PATHS: Record<string, React.ReactNode> = {
  // ── incidents ────────────────────────────────────────────────
  power: <><path d="M12 3v8" /><path d="M6.6 6.6a7.5 7.5 0 1 0 10.8 0" /></>,
  unlock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7.5A4 4 0 0 1 15.4 5.6" /><path d="M12 15v2" /></>,
  "person-leaving": <><circle cx="8.5" cy="7" r="3" /><path d="M3 20c0-3 2.5-5.5 5.5-5.5H10" /><path d="M14 16h7" /><path d="M18 13l3 3-3 3" /></>,
  magnifier: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.4 15.4 21 21" /><path d="M8 10.5h5M8 8h5M8 13h3" /></>,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19" /><path d="M6 15h4" /></>,
  "person-x": <><circle cx="9" cy="7" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6h1" /><path d="m15 14 6 6M21 14l-6 6" /></>,
  "cloud-off": <><path d="M6.5 18A4.5 4.5 0 0 1 6 9.1a6 6 0 0 1 10.4-2.3" /><path d="M18 9.5a4.5 4.5 0 0 1 .5 8.5H10" /><path d="M3 3l18 18" /></>,
  bug: <><rect x="8" y="8" width="8" height="11" rx="4" /><path d="M8 12H4M20 12h-4M8 16.5 4.5 18.5M15.9 16.5l3.6 2M8 8.5 5.5 6M16 8.5 18.5 6" /><path d="M10 6.5a2 2 0 1 1 4 0" /></>,
  stopwatch: <><circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.5 1.5" /><path d="M9.5 2.5h5" /><path d="M12 2.5V6" /></>,
  speech: <><rect x="2.5" y="4" width="12" height="8" rx="2.5" /><path d="M6 12v3.4L9.6 12" /><rect x="13" y="10" width="8.5" height="6.5" rx="2" /><path d="M19 16.5V20l-3-3.5" /></>,
  calendar: <><rect x="3.5" y="5.5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="m9 15 2 2 4-4" /></>,
  hook: <><path d="M12 3v9" /><path d="M12 12a4 4 0 1 1-8 0" /><path d="M9.5 4.5 12 2l2.5 2.5" /></>,

  // ── market events ────────────────────────────────────────────
  "shield-check": <><path d="M12 3 4.5 6v6c0 4.6 3.1 7.9 7.5 9 4.4-1.1 7.5-4.4 7.5-9V6z" /><path d="m8.8 12 2.2 2.2 4.2-4.4" /></>,
  gavel: <><rect x="13.4" y="2.6" width="8" height="5.2" rx="1.2" transform="rotate(45 17.4 5.2)" /><path d="m13.4 9.4-8 8" /><path d="m11.1 7.1 2.3 2.3" /><path d="M3 21h9" /></>,
  bolt: <><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" /></>,
  snowflake: <><path d="M12 2v20M3.4 7l17.2 10M20.6 7 3.4 17" /><path d="m9 4 3 2 3-2M9 20l3-2 3 2" /></>,
  star: <><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9L6.5 20l1-6.2L3 9.6l6.2-.9z" /></>,
  coin: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v10M9.5 9.5h4a2 2 0 0 1 0 4h-4M9.5 13.5h4" /></>,
  "trend-up": <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  network: <><circle cx="5" cy="18" r="2.6" /><circle cx="19" cy="18" r="2.6" /><circle cx="12" cy="5" r="2.6" /><path d="m10.6 7.4-4.2 8.2M13.4 7.4l4.2 8.2M7.6 18h8.8" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  tag: <><path d="M20.5 12.6 12.8 20.3a2 2 0 0 1-2.9 0l-6.2-6.2a2 2 0 0 1-.6-1.6l.5-6.1a2 2 0 0 1 1.8-1.8l6.1-.5a2 2 0 0 1 1.6.6l6.2 6.2a2 2 0 0 1 .2 1.7z" /><circle cx="8.2" cy="8.2" r="1.4" /></>,
  rosette: <><circle cx="12" cy="9" r="6" /><path d="m8.5 14.2-1.7 7 5.2-2.8 5.2 2.8-1.7-7" /><path d="m10 9 1.4 1.4L14.4 7" /></>,
  gauge: <><path d="M3.5 17a9 9 0 1 1 17 0" /><path d="m12 13 4.5-4" /><circle cx="12" cy="14" r="1.6" /></>,
  people: <><circle cx="9" cy="8" r="3.2" /><path d="M2.8 20c0-3.4 2.8-6.2 6.2-6.2s6.2 2.8 6.2 6.2" /><path d="M16.5 5.4a3.2 3.2 0 0 1 0 5.6" /><path d="M18 14.2c2 .9 3.3 2.8 3.3 5.1" /></>,
};

export function CardIcon({ name, size = 22 }: { name?: string; size?: number }) {
  const art = name ? PATHS[name] : undefined;
  if (!art) return null;
  return (
    <svg
      className="cardicon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    >
      {art}
    </svg>
  );
}
