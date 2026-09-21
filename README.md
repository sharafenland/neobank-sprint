# Neobank Sprint

An agile-process simulation for the **Financial Software Engineering** lecture.
Each group runs a neobank for several sprints on its own device; the lecturer
paces the room from a facilitator console.

Adapted from the CatTube sprint game, which is itself inspired by the
["Agile 101" board game](https://www.101ways.com/) by Emma Hopkinson-Spark (101 Ways).

---

## Running a session

1. Open `/host`, choose the number of sprints, create the session.
2. Write the four-character code on the board.
3. Groups open the start page, enter the code and a group name — one device per group.
4. You drive the phases from the facilitator console. Groups cannot skip ahead.

Both consoles carry a **cheat sheet** in every phase: the three formulas, with the
line for the current phase highlighted, and on a group's screen its live bonuses,
bug count and legacy drag underneath. `/rules` has the same sheet plus every card,
for students to open on a phone or for the projector before you start.

Six phases per sprint: **Sprint Planning → Development → Incident → Release →
Market Event → Retro & Investment.**

### Timing

| Sprints | Runtime | Use for |
| --- | --- | --- |
| 3 | ~45 min | a slot with a lecture before it |
| 4 | ~60 min | the standard single session |
| 6 | ~90 min | a full workshop, practices get time to compound |
| 8 | ~2 h | block seminar |

---

## Game design notes

The mechanics carry the teaching points; the slides only name them afterwards.

**One roll for the whole batch.** Development rolls a single d20 against the
*summed* targets of everything the group picked. Two features are not two
chances — they are one harder roll. That is batch size, and it is why large
releases fail more often.

**Two kinds of debt, taxing different things.**

| | Bugs | Audit findings |
| --- | --- | --- |
| Earned by | pushing unfinished work through | failed incidents, regulatory cards |
| Taxes | every Release roll | every Mitigation roll |
| Hard wall | 5 bugs → nothing ships | 3 findings → one slot less capacity |
| Paid down by | Automated Testing | Compliance by Design |

**Defensive features pay late.** Observability, Disaster Recovery and Privacy
earn almost nothing on release, and then decide the Incident and Market Event
phases. A backlog ranked purely on customer value never reaches them.

**Losses are proportional, gains are flat.** An outage or an enforcement action
costs a percentage of the customers you already have, with a floor so the first
sprints still sting. Flat penalties stop mattering once a group passes 80k, and
with them the reason to keep buying defensive work.

**Product and platform sit on the table together.** Six cards each sprint:
three product, three platform, one of each rotating out. Platform cards earn
few customers and pay a permanent modifier instead — capped at +4 per category,
so infrastructure shifts the distribution without removing the dice.

**Legacy drag.** One platform card carries two product features. Every product
feature past that adds +1 to the combined Development target, capped at +6.
This is the architectural half of technical debt; the bug counter only models
the unfinished-work half. Without it, a group that never builds infrastructure
pays nothing for it, and the game would teach the opposite of the course.

**Practices compound.** Twelve permanent practices, each labelled with the
session it comes from. `Agentic Coding` (Session 05) is deliberately
double-edged: +3 on Development, but pushing unfinished work through costs two
bugs instead of one.

**Cards carry their session.** The 23 platform cards are the course content —
Database Sharding and Caching Layer are Session 02, Microservice Migration and
Observability are Session 04, Test Automation and Code Quality Gates are
Session 06, Security Audit Log is Session 10. The label is printed on the card,
so a group choosing between them is choosing between lectures.

Card content lives in [`src/lib/cards.ts`](src/lib/cards.ts) (text and numbers)
and [`src/lib/effects.ts`](src/lib/effects.ts) (what each card does). Adding a
feature, incident or market event means editing those two files and nothing else.

### Balance, honestly

38 feature cards, 12 incidents, 13 market events. Simulated over 600 runs per
strategy with naive bots, no single approach dominates: pure growth and a
balanced one-of-each split finish level on the median at six and eight sprints,
while balanced carries far fewer bugs and almost no drag. Building only
platform cards loses badly, which is correct — it is not a strategy, it is a
refusal to sell anything.

That is where simulation stops being useful. The bots do not read the legacy
drag indicator and adapt; students do. The balance is sound enough to run and
should be revisited after the first real session.

---

## Architecture

```
src/lib/cards.ts     card text and numbers            (client + server)
src/lib/rules.ts     pure derivations: bonuses, targets, capacity
src/lib/derive.ts    seeded decks — market/incident/event per sprint
src/lib/effects.ts   what each card does to a team
src/lib/engine.ts    server-authoritative actions and phase entry
src/lib/store.ts     all SQL
src/app/api/…        five route handlers
src/app/play/[code]  the group console
src/app/facilitator  the projector console
src/app/rules        every card and formula on one page, for phones
```

**Every die is rolled on the server.** A group cannot reroll by reloading, and
the client never decides an outcome. `syncToPhase` applies each phase's entry
effects exactly once per team per sprint, keyed by `sprint:phase` markers in the
team's state, so polling twice or joining late lands in the same place.

**The deck comes from a seed**, not from rows: `marketFor(seed, sprint)` and
friends are pure functions, so there is no per-sprint deck state to keep
consistent. Six cards are on the table and two rotate out each sprint, whether
or not anyone picked them.

**Sync is polling**, every two seconds, from `useGame`. Thirty devices in a
lecture hall are well inside Neon's free tier. If you ever want it tighter,
replace the interval with SSE in that one hook — nothing else changes.

**Auth is two opaque tokens** in `localStorage`: a host token minted with the
session, a team token minted on join. Rejoining with the same group name returns
the existing token, so a group can switch devices without losing progress. This
is deliberately lightweight — it keeps students out of each other's consoles,
and it is not meant to survive someone who wants to cheat.

---

## The printed handout

```bash
npm run handout      # needs python3 with reportlab
```

Exports the decks from `src/lib/cards.ts` and builds
`handout/neobank-sprint-handout.pdf` — five A4 pages: the three formulas and
the sprint loop, every product card, every platform card with its session
label and permanent modifier, all incidents and market events with what moves
them, and a blank sprint tracker. Print pages 1–3 for the groups; keep 4 for
yourself, since it gives the incident and event outcomes away.

Because it is generated from the same file the game reads, the handout cannot
fall out of date. Re-run it after changing a card.

## Tests

```bash
npm test
```

Compiles the pure modules and plays 36 complete six-sprint games across three
strategies, checking that every phase can be finished, that no counter goes
negative, that retro income is paid exactly once however often a device polls,
that a group cannot roll twice, and that five bugs really do stop the release
train. No database needed.

## Local development

```bash
npm install
cp .env.example .env.local     # paste your Neon connection string
npm run db:push                # creates the three tables, safe to re-run
npm run dev
```

## Deploying to Vercel

1. Push the repository and import it in Vercel.
2. Add the **Neon** integration to the project — it sets `DATABASE_URL` for you.
3. Run `npm run db:push` once against the production database, or paste
   `db/schema.sql` into the Neon SQL editor.

No other configuration is needed; the app is a standard Next.js App Router
project.

## Schema

Three tables: `sessions` (code, seed, sprint, phase, host token), `teams`
(one row per group, whole state as `jsonb`) and `audit_log` (append-only, every
action with its sprint and phase). The audit log is not read by the app — it is
there so you can show the students afterwards what their own decisions looked
like as data.
