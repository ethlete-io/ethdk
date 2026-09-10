# Name the ticket

Milestone M3 of [`roadmap.md`](./roadmap.md). Grilled with Tom on 2026-09-10, in five rounds,
against four of his real tickets and one live meeting. It replaces the "Slice 2: Name it, in
outline" section of [`vertical-slices.md`](./vertical-slices.md), which described a per-repo rule
and naming by hand and nothing else.

The screen this runs on is M2 and the tickets it drafts are M4. Both are named in the roadmap and
neither is planned yet.

## What the real work looks like

Read through the running app on 2026-09-10:

| Key          | Type | Parent       | Summary                                                       |
| ------------ | ---- | ------------ | ------------------------------------------------------------- |
| FIFAGG-12605 | Epic | none         | Finals 2026: Bracket Challenge                                |
| FIFAGG-12623 | Task | FIFAGG-12605 | Spezifizierung Bracket Challenge im FE                        |
| FIFAGG-12624 | Task | FIFAGG-12605 | Umsetzung Bracket Challenge für Groups und Single Elimination |
| BD-2049      | Task | none         | Intern: Meeting 2025                                          |

And in the working copies, for the same work:

| Checkout                 | Branch                               | Books to     |
| ------------------------ | ------------------------------------ | ------------ |
| `fifagg/specs`           | `spec/20260819_bracket-challenge`    | FIFAGG-12623 |
| `fifagg/fifagg-frontend` | `feature/20260819_bracket-challenge` | FIFAGG-12624 |

Neither branch carries a key, so `parseBranch` names nothing and rungs 2, 3 and 4 all miss.

Tom's four weekly meetings, as he described them and as the app observed one of them:

| Meeting                | Title                 | In the calendar? | Books to        |
| ---------------------- | --------------------- | ---------------- | --------------- |
| Monday 09:15, Meet     | MoMe                  | Yes              | BD-2049         |
| Monday ~09:30, Discord | —                     | **No**           | a fifagg ticket |
| Wednesday 09:15, Meet  | Gaming Cluster Weekly | Yes              | a fifagg ticket |
| Thursday 11:30, Meet   | Brownies First        | Yes              | BD-2049         |

**These are test cases, not a specification.** Tom's words, on 2026-09-10: "these should only be used
to test if the system works. this is specific to my work and doesnt apply to all. they should just be
treated as good test cases." No meeting title, no weekday and no ticket key from the tables above may
appear anywhere in `libs/timetrack`. They are fixtures for a mechanism that has to work for anyone
who installs the app. This is the same rule the SDK already holds for theme names: an application
registers them and the library never names one.

Two facts fall straight out of that table. **One standing ticket takes two different series**, so a
remembered naming maps a series to a ticket and several series may name the same one. And the Monday
Discord call has no calendar entry and no fixed start: it begins when the MoMe meeting ends, plus
some minutes.

## Measured live, on 2026-09-10 at 11:57

The Calls card during the Thursday meeting, with the app running:

```
11:07 AM – 11:29 AM   Discord                22m   not counted
11:29 AM – 11:29 AM   Meet - Google Chrome    0m   not counted
11:29 AM – 11:57 AM   Meet - Google Chrome   28m   not counted
```

- **The microphone beats the calendar on the start.** The occurrence says 11:30. The call ran from
  11:29.
- **A Meet opens the microphone twice.** The 0-minute window is the pre-join device check, so it
  happens on every Meet call. `classifyCalls` (`stream/calls.ts:104`) filters nothing by length, so
  today one meeting becomes two bands.
- **The title in the card is the wrong title.** `CallWindow.title` is what the application held
  _before_ the call opened, which for a browser is the application name. The useful title, "Brownies
  First", is visible only through `titlesDuring`, and it matches the calendar occurrence exactly.
- **A Discord call ran on a Thursday**, ending exactly when the Meet began. Tom described the Discord
  call as a Monday thing. A fixed weekday rule would already be wrong, which is the argument for
  learned features over a hand-written rule.

## The design

### The ladder gains one rung, at position two

A **remembered naming** is a stored answer: a set of features, an issue key, a count and the date it
was last seen. One store, three writers, and the model is not one of them. See ADR 0012.

- **Tempo history seeds it.** `RecurringPattern` already carries issue key, weekday, start minute,
  end minute and a count. Rung 7 reads it and is dead code, because nothing passes `patterns` to
  the day's row options (`dayRowsOptionsOf` in `apps/timetrack/src/app/stream-day-options.ts`).
  Wiring that is what makes the store say anything on a first run.
- **A naming of Tom's outranks the seed**, and returns `certain`.
- **An accepted model proposal writes the record a naming writes.** A model never writes directly.

It keys on the application, the weekday, a duration band and the event that ran before it. The clock
time is a weak tiebreak only. Window titles stay out of these features: they are decisive for
picking a calendar candidate, and useless for the Monday Discord call, which has no calendar entry
to match against.

The rung sits under the private project link and above the branch grammar. A correction has to beat
a parse. Its confidence comes from the record, not from the rung.

### The epic rung

The branch slug names the epic; the epic plus the checkout names the task. Slug first, sibling
second. See ADR 0009.

### Meetings invert

The call is the fact and the calendar is a candidate list. See ADR 0010. An accepted occurrence with
no call observed proposes nothing; it becomes a question.

### When two rungs disagree

The band shows both and asks. It never picks the higher one silently.

### Ageing

A remembered naming never expires on a date. The app warns when the ticket a record names stops
being touched. `BD-2049` is called "Intern: Meeting 2025", it is still current in 2026, and a
successor will appear with nothing to announce it.

## What the model is missing

- **`recurringEventId` on `CalendarOccurrenceEvent`** (`model/event.ts:168`). Without the series id,
  naming a weekly meeting once is impossible.
- **`PinnedRow.issueKey` must become optional** (`review/model.ts:26`). A fresh cut leaves both
  halves unnamed, and an unnamed band has to be a legal state.
- **A call may be one call across two windows.** Glue two windows of the same application when the
  gap between them is short. That covers the Meet pre-join check and a call that drops and
  reconnects.
- **A meeting group rule.** `MeetingOptions.defaultIssueKey` is one global key. Several series map
  to one standing ticket, so the record has to name a group.

Deliberately **not** added: the other attendees of an invitation. A domain in an invitation would
name the client cheaply, and it is the most privacy-sensitive field on the roadmap.

## Exit test

A real day, judged by Tom in writing, in this order:

1. Before the screen is opened, he writes down which issue each piece of that day belongs to.
2. The screen is opened.
3. The day passes if every **band** carries that issue, or states in words why it cannot name one.

The word is band, not stream, because a band Tom split by hand must be able to pass (ADR 0011). The
screen writes local edits and never reaches Tempo, so a wrong answer costs a correction and never a
worklog.

## Not in this milestone

No booking. No ticket creation, no project-manager report, no model call, no anonymiser — those are
M4. Creation is designed here only far enough to say **when** it should be offered and **which
epic** it would use.
