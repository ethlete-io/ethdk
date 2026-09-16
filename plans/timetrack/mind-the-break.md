# Mind the break

Part of milestone M2 in [`roadmap.md`](./roadmap.md), beside [`draw-the-day.md`](./draw-the-day.md).
Written on 2026-09-16, from a real day Tom read on the day screen.

Tom's words: "breaks should be ediable / remove and restoreable. also they should be a little
smarter."

## What the screen showed

The day held three bands and one break:

- `ET-772 · in the background · 1h 30m`, from about 09:15 to about 10:45.
- `FIFAGG-12652 · 1h 30m`, the meeting "Gaming Cluster Weekly", over the same stretch.
- `ET-772 · 45m`, from about 10:45.
- A break of 15m, in the break lane, over the last quarter hour of the meeting.

The break and the meeting cover the same quarter hour. A person in a meeting is not away from the
day. Therefore the readout is wrong. Tom must also be able to correct it by hand after the rule is
fixed, because no rule catches every day.

## Why the app drew it

Three causes. All three are in the library, not on the screen.

1. **A call does not hold presence yet.** `presence.ts:19` reads presence from `window-focus` and
   `agent-prompt` samples only. A meeting where nobody types therefore opens a gap in presence, and
   `breakGaps` (`stream/breaks.ts`) reads that gap as a break. The section "Every call is presence"
   in [`draw-the-day.md`](./draw-the-day.md) already decided the opposite. The decision is written;
   the code does not hold it.
2. **The snap moves an end by up to half an increment.** `snapped` in `stream/breaks.ts` rounds both
   ends of a break to the nearest quarter hour. A break that ended at 10:38 is drawn to 10:45. A
   meeting that ended at 10:38 is drawn the same way. Either snap can push the two into the same
   quarter hour after every measurement is done.
3. **Nothing compares a break with a work band.** `lanes.ts:15` puts every break in a lane of its
   own, and the lane packer compares a break with no row. An overlap is drawn rather than refused.

## Rule 1: a break never covers a call

**Built on 2026-09-16**, all three steps. Recorded in ADR 0030. One correction to the reading below:
`streamDay` already unioned the calls into presence, through `countsAsWork` rather than through
attendance, so cause 1 was in `stream-day.ts` and not in `presence.ts`. `CallWindow.isPresence` is
the field that now answers it.

Three steps, in this order:

1. Make a call hold presence, as "Every call is presence" says. The gap then never opens, so the
   measured break never exists. This is the real fix.
2. Keep a guard after the snap. `breaksBetweenRows` clips every break against the calls that count
   as presence. What is left shorter than one increment is dropped.
3. Keep the exception. A record marks an application or a room as **not** presence — the open
   Discord room. A break inside such a room survives the clip.

Step 2 is not a duplicate of step 1. Step 1 works on measured time. Step 2 works on the snapped
windows the screen draws, and cause 2 above makes an overlap after the measurement.

**Open, for Tom:** does the same guard apply to a hard timer run? A timer is the user's own
statement that they work. The case is rarer than the meeting, so it can wait.

## Rule 2: a break edit is a statement about a stretch of the day

**Built on 2026-09-16**, apart from the totals. `PresenceStatement` and `DayReviewEdits.statements`
are in the library, the writers are in `review/statements.ts`, and `breaksBetweenRows` applies them.
On the screen a press on a break states `present`, a range drawn in the break lane states `away`, and
the day's notes take a statement back. Proofs 4, 5 and 6 are in `review/statements.spec.ts`, and one
e2e flow is in `apps/timetrack-e2e/src/break-statement.spec.ts`.

Two corrections to the reading below. Writing a statement takes the stretch out of every statement of
the other kind it covers, so the day never holds two that contradict each other and the order they are
applied in never decides the answer. And the break lane stays on a day whose breaks are all gone,
because the lane is where a break is drawn.

**Still open:** the day's `present` total and its engagement ratio do not follow the statements yet.

A break has no id. It is derived from the gaps between two stretches of presence, and a new event
moves it. An edit keyed by a break object therefore does not survive the next run of `streamDay`.

So the user does not edit a break. The user states what a stretch of the day was:

| Statement | What the user says | What the day does                         |
| --------- | ------------------ | ----------------------------------------- |
| `present` | "I was here."      | Every break is clipped out of the window. |
| `away`    | "I was away."      | A break is drawn over the window.         |

Every operation Tom asked for is one of the two, or the deletion of one:

- **Remove a break:** write a `present` statement over it.
- **Restore it:** delete that statement.
- **Shorten a break, or move one end:** write a `present` statement over the part to drop.
- **Add a break:** write an `away` statement.
- **Reset the day:** delete every statement of the day.

A statement outranks every derived rule, the call guard of rule 1 included. If Tom says he was away
during a meeting, the app draws the break and does not argue.

**The alternative**, and why it lost. Four operations against a break identity, with `hideRow` and
`showRow` (`review/edits.ts:141`) as the precedent. It matches how a row is edited today, which is
worth something. It needs a stable break id, which the pipeline cannot give, and it needs four code
paths where two answer the same question.

## Where a statement is stored

In `day_review`, on `DayReviewEdits` (`review/model.ts:66`). The table holds that whole type as one
JSON document (`src-tauri/src/db.rs:36`), so a new field needs no SQL migration. An older document
that carries no field reads as a day with no statement.

```ts
export type PresenceStatement = {
  id: string;
  kind: 'present' | 'away';
  from: Date;
  to: Date;
};
```

`DayReviewEdits` gains `statements: PresenceStatement[]`, and `EMPTY_DAY_REVIEW_EDITS` gains an empty
array. Both ends of a statement snap to the increment the rows sit on, so a statement lines up with
the bands around it.

## What a statement changes, and what it must not

- `breakMs` follows the statements. It is what the day reports as time away.
- A booking never moves. A break books nothing today, and it is drawn over the rows rather than cut
  out of them. A statement therefore changes no row and no sync.
- `unattendedMs` stays measured. It answers what ran, not who was there. A `present` statement does
  not claim the user watched the agent.
- The day's `present` total and its engagement ratio follow the statements too. The app is a human
  factor tool, not a surveillance tool, so the number the user believes is the number it shows. The
  measured total stays in the day's notes, so the correction is visible.

**Open, for Tom:** the last point is the one decision here that is easy to disagree with. Say so
before it is built.

## What has to be proven

Unit tests in `libs/timetrack`, in `stream/breaks.spec.ts` and a new `review/statements.spec.ts`:

1. A break over a call that counts as presence is dropped.
2. A break inside a room marked not presence survives.
3. A snap that pushes a break end into a call is clipped back. A remainder shorter than one
   increment is dropped.
4. A `present` statement removes the break. The deletion of that statement brings the break back.
5. An `away` statement draws a break where presence holds no gap.
6. A statement survives a run of `streamDay` that moves the measured break by a few minutes.

One e2e flow under [`e2e-strategy.md`](./e2e-strategy.md): seed a day with a meeting nobody typed
in, open Day, and check the break lane holds nothing. Then write an `away` statement over the
meeting, and check the break appears.

Every test must fail without its fix. Write the test first and watch it fail.

## Not in this

- No change to the hard pause. A pause stops collection; a statement corrects a reading. The two are
  different facts and stay apart.
- No sync. A statement stays local, like every other `day_review` edit.
- No rule learned from a statement. A correction Tom repeats may later teach a record, and that store
  is M3's.
