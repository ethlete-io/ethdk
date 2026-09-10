# Draw the day

Milestone M2 of [`roadmap.md`](./roadmap.md). Grilled with Tom on 2026-09-10, after the five rounds
that produced [`name-the-ticket.md`](./name-the-ticket.md). It holds the old slice 4 as well, because
a timeline that hides a meeting is not the timeline he asked for.

His words for what this milestone is: "for a day view id like to have a clear timeline of what i did
and when i did it."

## The two screens today

| Screen     | Draws                                   | Fed by         |
| ---------- | --------------------------------------- | -------------- |
| Today      | Streams in an accordion. No time axis.  | `streamDay`    |
| Day Review | A 24-hour axis, beside a table of rows. | `correlateDay` |

They merge into one (ADR 0011). A band on it is a **row**, not a stream, because a row already
splits, merges and moves its boundary, and a stream is keyed by its checkout under ADR 0001 and
cannot be cut.

## The step that is not a screen job

The timeline is fed entirely by `correlateDay`, the pipeline ADR 0007 schedules for deletion.
`streamDay` produces nothing row-like, and `stream/` may not import `correlate/` under ADR 0004. So
the merged screen cannot borrow the old builder, and building it on v1 would build it twice.

ADR 0014 records the decision. Tom's words: "v1 can move into the trashcan. we can and should rebuild
it into something that actually works."

**Step one: the pipeline, with no screen change.** `streamDay` gains a proposal builder, and it takes
over what only `correlateDay` sees today:

- Editor, calendar and GitLab events, which `streamDay` never reads.
- `TimerRun` and `ClosedTimerRun` (`model/timer.ts:5,17`), matched today by `matchTimerRuns`.
- Pauses, which are plain `TimeWindow`s from `pauseWindows` (`correlate/pauses.ts:25`). Note that
  `DayCorrelation.pauses` never reaches the timeline component even now.
- Meetings, under ADR 0010, and the unattributed blocks.

It is testable against the screen that exists: the same day, read through both pipelines, must
produce the same rows before anything on screen changes.

**Step two: the merged screen**, drawn on the new output.

## What the screen does

### Every call is presence

Tom: "a call means presence. i remember no time when i was afk in a call. though there are exeptions
like the dicord open room so as always it depends lol."

So a call counts, and the exception is the escape hatch, not the default. A record marks an
application or a room as **not** presence — the open Discord room is the case that needs it. That
record is a remembered naming (ADR 0012), so this needs no rules screen and no second concept.

This reverses today's behaviour, where every call reads "not counted" until a rule names it.

### Concurrent work books twice, and nothing is reduced

Tom: "both parties need to pay for the work that got done. everything else makes no sense."

Two bands over the same hour both book in full. `CONTEXT.md` already rules that each stream books its
full time; this milestone keeps it and applies it to bands. The overlap is **marked** so it can be
seen, and it is never resolved automatically.

**This adds no gate to M6.** A day whose bands sum past its wall clock is correct under this rule, so
the sync must not refuse it.

### Overlap is drawn as lanes, and the SDK gets the fix

`packColumns` (`libs/components/src/lib/scheduler/headless/internals/scheduler-time-grid.ts:60-105`)
already packs arbitrary N-way overlap: transitive clusters, first free column per entry,
`inlineSize = 100 / columnCount`. `DayTimelineComponent` only reads `inlineOffset` and `inlineSize`,
so lanes need no app work at all.

It has one real weakness, and Tom asked for it to be addressed here: every block in a cluster gets
equal width, and none widens into free space. One short overlap therefore makes a whole cluster thin
for the entire day. **That fix belongs in `libs/components`**, so it needs a changeset and a docs
page, unlike the rest of this milestone.

### The axis stays 24 hours

Fixed at 8rem per hour, opened scrolled to the first activity. A cropped span would rescale the day,
so the same one-hour meeting would be a different height on Tuesday than on Monday, and a screen that
rescales itself is hard to trust.

### A day starts at a configured hour

ADR 0015. Work at 01:00 belongs to the evening it came from. The boundary reaches `day_review`, the
coverage store and the pipeline input together, or two parts of the app will disagree about which day
an hour is in.

## Also in this milestone

- **Split and glue.** `splitRow`, `mergeRows` and `moveRowBoundary` (`review/edits.ts:107,363,165`)
  are built. `PinnedRow.issueKey` becomes optional (`review/model.ts:26`), so a fresh cut can stand
  with neither half named.
- **Two windows of the same application separated by a short gap are one call.** Every Google Meet
  opens the microphone twice, because its pre-join screen runs a device check. Measured on 2026-09-10:
  a 0-minute window at 11:29, then the real call from 11:29 to 11:57. `classifyCalls`
  (`stream/calls.ts:104`) filters nothing by length today, so one meeting becomes two bands. The same
  rule covers a call that drops and reconnects.

The screen writes local edits to `day_review` and never reaches Tempo.

## Exit test

Tom reads a real day on one screen, and cuts it where he wants it cut. It is a written judgment, and
it is not automatable.

Before step two is called done, step one has its own check: one real day read through both pipelines
produces the same rows.

## Not in this milestone

No naming beyond what the ladder already does — that is M3. No ticket drafts, no report, no model
call, no anonymiser — that is M4. No booking.
