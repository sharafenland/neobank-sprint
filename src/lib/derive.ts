/**
 * The deck a session plays is derived from its seed, so every device agrees on
 * the market, the incident and the market event without storing them per sprint.
 */
import { EVENTS, FEATURES, INCIDENTS } from "./cards";

const CODE_ALPHABET = "ACDEFGHJKLMNPQRTUVWXY3479"; // no O/0, I/1, S/5, B/8

export function makeCode(): string {
  let out = "";
  for (let i = 0; i < 4; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

export function makeToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const rand = mulberry32(seed >>> 0);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const cache = new Map<number, { features: string[]; incidents: string[]; events: string[] }>();

function decks(seed: number) {
  let d = cache.get(seed);
  if (!d) {
    d = {
      features: seededShuffle(FEATURES.map((f) => f.id), (seed ^ 0x9e3779b9) >>> 0),
      incidents: seededShuffle(INCIDENTS.map((c) => c.id), (seed ^ 0x85ebca6b) >>> 0),
      events: seededShuffle(EVENTS.map((c) => c.id), (seed ^ 0xc2b2ae35) >>> 0),
    };
    cache.set(seed, d);
  }
  return d;
}

/** Six cards on the table; two rotate out every sprint, picked or not. */
export function marketFor(seed: number, sprint: number): string[] {
  const d = decks(seed).features;
  const start = 2 * (sprint - 1);
  return Array.from({ length: 6 }, (_, i) => d[(start + i) % d.length]);
}

export function incidentIdFor(seed: number, sprint: number): string {
  const d = decks(seed).incidents;
  return d[(sprint - 1) % d.length];
}

export function eventIdFor(seed: number, sprint: number): string {
  const d = decks(seed).events;
  return d[(sprint - 1) % d.length];
}
