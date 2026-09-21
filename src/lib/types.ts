export type Category = "core" | "growth" | "compliance" | "platform";

export interface Feature {
  id: string;
  n: string;
  c: Category;
  /** Development target contributed to the combined roll. */
  t: number;
  /** Release target contributed to the combined roll. */
  r: number;
  /** Reward in thousands of customers. */
  k: number;
  /** Capacity slots consumed. */
  s: number;
  b: string;
  /** Lecture session this card teaches, printed on the card. */
  src?: string;
  /**
   * Permanent modifier once the card is in the portfolio. Infrastructure earns
   * few customers directly and pays through these instead.
   */
  bonus?: { dev?: number; rel?: number; mit?: number };
}

export interface Practice {
  id: string;
  n: string;
  ip: number;
  src: string;
  e: string;
}

/**
 * Features a card leans on. A session only deals thirty-nine cards' worth of
 * market across six-card tables, so a card whose counter-play never reaches
 * the table is either dead or a tax nobody could have avoided. `needs` lists
 * the features that make the card mean something; `needsCount` is how many of
 * them must be showable (default: all of them).
 *
 * Cards whose counter-play is a *practice* need nothing: the shop is always open.
 */
export interface CardDeps {
  needs?: string[];
  needsCount?: number;
  /** Key into the icon set in components/CardIcon.tsx. */
  icon?: string;
}

export interface IncidentCard extends CardDeps {
  id: string;
  n: string;
  txt: string;
  /** Mitigation target, or null when the card simply happens. */
  mit: number | null;
  onlyTxt?: string;
  autoTxt?: string;
}

export interface EventCard extends CardDeps {
  id: string;
  n: string;
  txt: string;
  /** Set when resolving the card needs the facilitator to name a group. */
  needsCall?: string;
}

export interface BuiltItem {
  id: string;
  buggy: boolean;
  shelved: boolean;
}

export interface LogEntry {
  s: number;
  txt: string;
  dir: "" | "up" | "down";
}

export interface TeamState {
  customers: number;
  bugs: number;
  findings: number;
  ip: number;
  ipSpent: number;
  shipped: number;
  practices: string[];
  portfolio: string[];

  /** Per-sprint working set. */
  picked: string[];
  /** Slots spent on paying down debt instead of taking new work. */
  fix: { bugs: number; findings: number };
  confirmed: boolean;
  dev: { roll: number; total: number; target: number; pass: boolean; decided: Record<string, "push" | "shelve"> } | null;
  built: BuiltItem[];
  inc: { skip: boolean; auto: boolean; rolled: boolean; roll?: number; total?: number; pass?: boolean; done: boolean } | null;
  rel: { blocked: boolean; rolled: boolean; roll?: number; total?: number; target?: number; full?: boolean; done: boolean } | null;
  eventResolved: { d: number; f: number; w: string } | null;

  devMod: number;
  blockRelease: boolean;
  ipPenalty: number;
  /** What the retro paid and why, for the panel to explain itself. */
  retroPay: { base: number; bonus: number; reason: string } | null;

  /** Marks which sprint/phase entry effects have already been applied. */
  applied: Record<string, true>;
  feed: LogEntry[];
}

export interface SessionRow {
  code: string;
  seed: number;
  sprints: number;
  sprint: number;
  phase: number;
  reveal_incident: boolean;
  reveal_event: boolean;
  finished: boolean;
}

export interface TeamSummary {
  name: string;
  customers: number;
  bugs: number;
  findings: number;
  ip: number;
  practices: string[];
  picked: string[];
  confirmed: boolean;
  phaseDone: boolean;
}

export interface GameView {
  session: SessionRow;
  market: string[];
  incidentId: string;
  eventId: string;
  teams: TeamSummary[];
  /** Present only for the requesting device. */
  you?: { name: string; state: TeamState };
}
