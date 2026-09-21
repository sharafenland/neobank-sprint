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
}

export interface Practice {
  id: string;
  n: string;
  ip: number;
  src: string;
  e: string;
}

export interface IncidentCard {
  id: string;
  n: string;
  txt: string;
  /** Mitigation target, or null when the card simply happens. */
  mit: number | null;
  onlyTxt?: string;
  autoTxt?: string;
}

export interface EventCard {
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
  confirmed: boolean;
  dev: { roll: number; total: number; target: number; pass: boolean; decided: Record<string, "push" | "shelve"> } | null;
  built: BuiltItem[];
  inc: { skip: boolean; auto: boolean; rolled: boolean; roll?: number; total?: number; pass?: boolean; done: boolean } | null;
  rel: { blocked: boolean; rolled: boolean; roll?: number; total?: number; target?: number; full?: boolean; done: boolean } | null;
  eventResolved: { d: number; f: number; w: string } | null;

  devMod: number;
  blockRelease: boolean;
  ipPenalty: number;

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
