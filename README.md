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

**Practices compound.** Twelve permanent practices, each labelled with the
session it comes from. `Agentic Coding` (Session 05) is deliberately
double-edged: +3 on Development, but pushing unfinished work through costs two
bugs instead of one.

Card content lives in [`src/lib/cards.ts`](src/lib/cards.ts) (text and numbers)
and [`src/lib/effects.ts`](src/lib/effects.ts) (what each card does). Adding a
feature, incident or market event means editing those two files and nothing else.

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
