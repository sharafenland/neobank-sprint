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
| Paid down by | Automated Testing, or a slot | Compliance by Design, or a slot |

**Investment points are earned and then expire.** A retro pays two, and from
sprint 3 a third when the sprint handled its incident — rolled and won, or
built the card that removes it — or ended with no bugs. One extra point,
however well both went. Nothing carries over: whatever is unspent at the retro
is gone when the next sprint starts.

That pair of rules is what makes the retro a decision rather than a savings
account. Flat income that accumulates means a group that played well and one
that floundered arrive at the same shop with the same money, and the only
question is when to spend. With a conditional point and no hoarding, the
three-point practices — Definition of Done, Cross-Functional Team, Retro
Culture, Agentic Coding, Compliance by Design — exist only for a sprint that
earned them, and a spare point left on the table is a point lost.

**Findings clear two ways, both of them a choice.** A remediation slot clears
one, and Compliance by Design clears one each retro — priced at 2 IP, the same
as Automated Testing, because the two are meant to read as a pair: one pays
down technical debt automatically, the other regulatory debt. At 3 IP it
competed with Cross-Functional Team and Definition of Done and was never
bought in a session shorter than eight sprints; at 2 IP a group that has
noticed its findings can buy it the same retro, every time.

**Debt can always be worked off, at the price of the sprint.** During planning
a group may spend capacity on remediation instead of features: one slot clears
two bugs, or one audit finding. It resolves at the start of Development, before
the release roll, so a team at five bugs can spend one slot and ship again in
the same sprint. Without it, five bugs is not a hard state to recover from, it
is a state with no decisions in it — releases blocked, the only lever a 2 IP
practice that clears one bug a retro and does not clear in the retro you buy
it, which is two dead sprints of watching. The choice is the lesson: you can
always stop and fix, it just costs you what the sprint would have earned.

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

**Three-slot cards are gated, not just expensive.** Microservice Migration and
Core Banking Migration cost three slots against a base capacity of two, so
neither can be taken until Cross-Functional Team is bought — 3 IP against an
income of 2 a retro, which lands at the sprint-3 planning at the earliest. The
deal therefore holds them back until then: dealt in sprint 1 they are not a
hard choice, they are a card that cannot be clicked, occupying one of three
platform places for three sprints. When a card is out of reach the planning
screen says why on the card itself, rather than greying it out in silence.

**Legacy drag.** One platform card carries two product features. Every product
feature past that adds +1 to the combined Development target, capped at +6.
This is the architectural half of technical debt; the bug counter only models
the unfinished-work half. Without it, a group that never builds infrastructure
pays nothing for it, and the game would teach the opposite of the course.

**Practices compound.** Twelve permanent practices, each labelled with the
session it comes from. `Agentic Coding` (Session 5) is deliberately
double-edged: +3 on Development, but pushing unfinished work through costs two
bugs instead of one.

**Cards carry their session.** The platform cards and the practices are the
course content, each labelled with the lecture it comes from, so a group
choosing between two cards is choosing between two lectures:

| Session | Cards |
| --- | --- |
| 1 Foundations & Data Management I | Core Ledger |
| 2 Data Management II: Scaling | Database Sharding, Data Pipeline, Data Warehouse, Caching Layer, Performance Profiling |
| 3 Architecture for Financial Systems | Microservice Migration, API Gateway, Disaster Recovery, *Modular Architecture* |
| 4 Specialties in Finance I: Mainframes | Core Banking Migration |
| 5 Agentic Software Engineering | *Agentic Coding* |
| 6 Software Quality & Testing | Test Automation Suite, Code Quality Gates, Error Tracking, A/B Testing System, *Automated Testing* |
| 7 Collaborative Development with Git & Agile | Documentation Wiki, *Pair Programming*, *Definition of Done*, *Retro Culture*, *Cross-Functional Team* |
| 8 CI/CD, DevSecOps & Secure Coding | Containerization, Rate Limiting, Security Audit Log, *CI/CD Pipeline* |
| 9 From Code to Production | Observability Stack, Service Monitoring, Incident Runbooks, Backup & Recovery, Load Balancer, CDN Integration, *Observability & SRE*, *Feature Flags*, *Blameless Postmortems* |
| 10 Specialties in Finance II: Regulation | KYC Onboarding, AML Monitoring, PSD2 API, Strong Customer Auth, Privacy & GDPR, *Compliance by Design* |

*Italic* entries are practices from the retro shop; the rest are feature cards.
Sessions 3, 6, 7, 8 and 9 carry most of the deck, which is the point &mdash; those
are the lectures the game is arguing for.

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

## Theme

The palette is the school's: `#003E5B` for the accent, `#173042` for text,
`#627186` for secondary, `#DCE5EA` for tinted panels — the same values the
handout takes from the lab instructions, so the screen and the paper match.

Dark mode cannot use `#003E5B` as an accent; it disappears against a dark
ground. It lifts to `#5CAACB`, the tint the school uses on navy, and a
separate `--on-accent` token carries the text colour that sits on the accent:
white in light, near-black in dark.

Every screen has a **Light / Dark switch**, stored per device. A lecture hall
is usually dim and a group's laptop usually is not, so the two ends of the
room want opposite themes. An inline script in the layout stamps the stored
choice on `<html>` before first paint, so nothing flashes; `<html>` carries
`suppressHydrationWarning` because that attribute is, by design, one the
server did not render. With nothing stored, the operating system decides.

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
consistent. Six cards are on the table — three product, three platform — and
one of each rotates out per sprint, whether or not anyone picked them. A card
therefore sits on the table for exactly three sprints, and a six-sprint session
shows 16 of the 39 cards, an eight-sprint one 20. Two sessions with different
codes share very little, which is what makes a second lecture a different game.

**Cards are dealt against what the table has shown.** Because a session never
offers the whole deck, an incident or market event can hang on a feature that
was never available: rewarding Crypto Custody in a session that never offered
it does nothing to anybody, and punishing the absence of Privacy & GDPR taxes a
choice nobody was given. So incidents and events declare `needs` — the features
that make them mean something — and `scheduleFor` deals only cards whose needs
the table has already met. Cards whose counter-play is a *practice* declare
nothing, since the shop is always open.

When the fitting pool runs dry, late in a long session, it repeats a card that
fits rather than dealing one that does not: the same outage twice is a question
worth asking. Measured over 3000 seeds, no card is ever dealt with an unmet
dependency, and repeats first appear in sprint 5 (0.1% of cards) and stay under
2% through sprint 8. The schedule is computed for a fixed twelve sprints so it
depends on the seed alone — adding a sprint must not rewrite sprint 2.

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
`handout/neobank-sprint-handout.pdf` — six A4 pages: the rules and the
practice shop, every product card, every platform card with its session label
and permanent modifier, all incidents and market events with what moves them,
and a blank sprint tracker. Print pages 1–4 for the groups; keep 5 for
yourself, since it gives the incident and event outcomes away.

It is laid out to match `FSE_Session_5_Agentic_Lab.pdf` — same Frankfurt
School band, 63pt margins, palette and Helvetica/Courier setting, all measured
off that file — so the two sit together in a folder. The mark in the header is
extracted from it into `handout/fs-logo.png`.

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
