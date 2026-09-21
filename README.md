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
line for the current phase highlighted. Both consoles keep it in the right-hand
rail so the main column holds only what is being looked at — the cards, the
incident, the event. A group's copy carries that group's live bonuses, bug
count and legacy drag underneath; the facilitator's is followed by the phase's
teaching point and the live standings. Below 900px the rail stacks, and the
cheat sheet is ordered to the top rather than buried under the phase, because
half the room is on a phone.

The formulas start **collapsed** — they are reference, read once — and the
choice is remembered per device. The status line underneath is not collapsible:
those numbers are what a group checks between every roll. `/rules` shows the
sheet open, since reading it is the point of that page.

The facilitator's rail reads: access code, cheat sheet, teaching point, live
standings. The teaching point is collapsed too, but its heading stays visible —
"Scope is a commitment, not a wish list" already says most of it; the paragraph
behind it is what you read out.

Each phase names the roll it is asking for — **Roll to build**, **Roll to
mitigate**, **Roll to release** — rather than naming the action, so it is always
obvious that a die is about to decide something. `/rules` has the same sheet plus every
card, for students to open on a phone or for the projector before you start.

### Changing your mind about the length

The retro is where the room can be redirected. At any retro before the last you
get **End the game now** — two clicks, because a slip there is not recoverable —
which finishes the session after the sprint in progress. At the last retro you
get **Add another sprint** instead, up to a ceiling of twelve. Neither needs the
groups to do anything; their screens follow.

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

**Two drivers, one `sql`.** On Vercel the connection string points at Neon and
`src/lib/db.ts` uses its HTTP driver, which is what works from a serverless
function. Against any other host it falls back to node-postgres, so the project
runs and is testable on a laptop with no cloud account. Both are resolved
lazily — `next build` never needs a database.

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
docker compose up -d           # Postgres 16 on port 5433
echo 'DATABASE_URL="postgres://neobank:neobank@localhost:5433/neobank_sprint"' > .env.local
npm run db:push                # creates the three tables, safe to re-run
npm run dev
```

Port 5433 rather than the default, so this does not collide with another
project's database. To develop against Neon instead, put that connection
string in `.env.local` — the driver switches itself.

### The integration test

```bash
BASE=http://localhost:3000 npm run smoke
```

Creates a session, joins two groups and drives every phase of every sprint
through the HTTP API. It checks what the unit test cannot: the SQL, the token
checks (a group cannot move the room; an unjoined device cannot act), that a
group cannot roll twice or resolve an event twice, that an action from the
wrong phase is refused, and that a finished session is closed. Run it against
a preview deployment before a lecture.

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
