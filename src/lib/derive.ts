/**
 * The deck a session plays is derived from its seed, so every device agrees on
 * the market, the incident and the market event without storing them per sprint.
 */
import { EVENTS, FEATURES, INCIDENTS } from "./cards";
import type { CardDeps } from "./types";

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

const cache = new Map<number, { product: string[]; platform: string[]; incidents: string[]; events: string[] }>();

const PRODUCT_IDS = FEATURES.filter((f) => f.c !== "platform").map((f) => f.id);
const PLATFORM_IDS = FEATURES.filter((f) => f.c === "platform").map((f) => f.id);

function decks(seed: number) {
  let d = cache.get(seed);
  if (!d) {
    d = {
      product: seededShuffle(PRODUCT_IDS, (seed ^ 0x9e3779b9) >>> 0),
      platform: seededShuffle(PLATFORM_IDS, (seed ^ 0x27d4eb2f) >>> 0),
      incidents: seededShuffle(INCIDENTS.map((c) => c.id), (seed ^ 0x85ebca6b) >>> 0),
      events: seededShuffle(EVENTS.map((c) => c.id), (seed ^ 0xc2b2ae35) >>> 0),
    };
    cache.set(seed, d);
  }
  return d;
}

/**
 * Six cards on the table: three product, three platform. One of each rotates
 * out per sprint. The split is deliberate — drawn from one pile, a deck that is
 * half infrastructure would regularly offer a table with nothing to sell, and
 * the trade-off the game is about would disappear.
 */
export function marketFor(seed: number, sprint: number): string[] {
  const d = decks(seed);
  const at = sprint - 1;
  const take = (pile: string[]) => Array.from({ length: 3 }, (_, i) => pile[(at + i) % pile.length]);
  return [...take(d.product), ...take(d.platform)];
}

/** Every feature that has reached the table by the end of this sprint. */
function shownThrough(seed: number, sprint: number): Set<string> {
  const shown = new Set<string>();
  for (let s = 1; s <= sprint; s++) for (const id of marketFor(seed, s)) shown.add(id);
  return shown;
}

function satisfied(card: CardDeps, shown: Set<string>): boolean {
  if (!card.needs?.length) return true;
  const have = card.needs.filter((id) => shown.has(id)).length;
  return have >= (card.needsCount ?? card.needs.length);
}

/**
 * The longest a session can run, and therefore how far ahead the schedules are
 * computed. Keeping this fixed is what makes them depend on the seed alone: a
 * facilitator who adds a sprint must not retroactively change sprint 2.
 */
export const SCHEDULE_LENGTH = 12;

/**
 * Deals one card per sprint, skipping any whose counter-play has not reached
 * the table yet. A card that rewards Crypto Custody in a session that never
 * offered it does nothing to anybody; one that punishes the absence of Privacy
 * & GDPR taxes a choice nobody was given. Both are dealt only once the feature
 * they hang on is available.
 *
 * Falls back to cards with no dependency, and then to anything unused, so a
 * sprint always has a card.
 */
function scheduleFor<T extends CardDeps & { id: string }>(
  pile: T[], order: string[], seed: number,
): string[] {
  const byId = new Map(pile.map((c) => [c.id, c]));
  const used = new Set<string>();
  const out: string[] = [];

  for (let sprint = 1; sprint <= SCHEDULE_LENGTH; sprint++) {
    const shown = shownThrough(seed, sprint);
    const free = (id: string) => !byId.get(id)!.needs?.length;
    // A repeat of a card that fits beats a fresh card that does not: the same
    // outage twice is a question worth asking, a reward for something nobody
    // was offered is a wasted phase.
    const seenFree = out.filter(free);
    const pick =
      order.find((id) => !used.has(id) && satisfied(byId.get(id)!, shown)) ??
      order.find((id) => !used.has(id) && free(id)) ??
      order.find((id) => free(id) && !seenFree.slice(-2).includes(id)) ??
      order.find((id) => !used.has(id)) ??
      order[(sprint - 1) % order.length];
    used.add(pick);
    out.push(pick);
  }
  return out;
}

const schedules = new Map<number, { incidents: string[]; events: string[] }>();

function scheduled(seed: number) {
  let s = schedules.get(seed);
  if (!s) {
    const d = decks(seed);
    s = {
      incidents: scheduleFor(INCIDENTS, d.incidents, seed),
      events: scheduleFor(EVENTS, d.events, seed),
    };
    schedules.set(seed, s);
  }
  return s;
}

export function incidentIdFor(seed: number, sprint: number): string {
  const d = scheduled(seed).incidents;
  return d[(sprint - 1) % d.length];
}

export function eventIdFor(seed: number, sprint: number): string {
  const d = scheduled(seed).events;
  return d[(sprint - 1) % d.length];
}
