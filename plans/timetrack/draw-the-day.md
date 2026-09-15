# Draw the day

Milestone M2 of [`roadmap.md`](./roadmap.md). Grilled with Tom on 2026-09-10, after the five rounds
that produced [`name-the-ticket.md`](./name-the-ticket.md). It holds the old slice 4 as well, because
a timeline that hides a meeting is not the timeline he asked for.

His words for what this milestone is: "for a day view id like to have a clear timeline of what i did
and when i did it."

## The two screens this started from

| Screen     | Drew                                    | Fed by         |
| ---------- | --------------------------------------- | -------------- |
| Today      | Streams in an accordion. No time axis.  | `streamDay`    |
| Day Review | A 24-hour axis, beside a table of rows. | `correlateDay` |

They merged into one (ADR 0011). A band on it is a **row**, not a stream, because a row already
splits, merges and moves its boundary, and a stream is keyed by its checkout under ADR 0001 and
cannot be cut.

## The step that is not a screen job

The timeline is fed entirely by `correlateDay`, the pipeline ADR 0007 schedules for deletion.
`streamDay` produces nothing row-like, and `stream/` may not import `correlate/` under ADR 0004. So
the merged screen cannot borrow the old builder, and building it on v1 would build it twice.

ADR 0014 records the decision. Tom's words: "v1 can move into the trashcan. we can and should rebuild
it into something that actually works."

**Step one: the pipeline, with no screen change. Built on 2026-09-10.** `streamDay` gained a proposal
builder, and it took over what only `correlateDay` saw:

- Editor, calendar and GitLab events, which `streamDay` never reads.
- `TimerRun` and `ClosedTimerRun` (`model/timer.ts:5,17`), matched today by `matchTimerRuns`.
- Pauses, which are plain `TimeWindow`s from `pauseWindows` (now `stream/pauses.ts`). Note that
  `DayCorrelation.pauses` never reaches the timeline component even now.
- Meetings, under ADR 0010, and the unattributed blocks.

It was testable against the screen that existed: the same day, read through both pipelines, had to
produce the same rows before anything on screen changed. `stream/both-pipelines.spec.ts` was that
check, and the two agreed except where ADR 0007 had already measured the drift — `sessionize` handed
the browser that opens a meeting five minutes of the editor's branch and `streamDay` does not.

ADR 0016 changed what "the port" meant. Every file in `correlate/` but `sessionize.ts` and
`correlate-day.ts` turned out to have no dependency on the v1 pipeline at all, so they moved to
`rows/` rather than being duplicated into `stream/`. Both pipelines now call one `buildRows`.

**Step two: the merged screen. Built on 2026-09-10.** Today merged into Day, and `/today` redirects
there. `readDay$` and the day store both read `streamDay`, `reviewDay` takes a `DayRows`, and
`correlate/` is deleted.

What the one screen holds, top to bottom: the day navigation, the totals Today reported (present,
engaged, the ratio and its fire, unattended, rebuilt), the day's warnings, the 24-hour timeline
beside the row list and the naming card, the streams accordion, and the footer's target line. The
day's notes — the rebuilt stretch, the calls, the ambiguous checkout names, the window time no
checkout took and the spend no checkout can carry — sit under the row list.

Two things the merge had to correct. The timeline drew the unattributed blocks _behind_ the rows,
and those minutes are a row now, so the same hour was drawn twice; the blocks are gone. And the grid
opened at the current hour on a day that is today, which shows empty grid at six in the evening, so
the day now opens an hour before its earliest band.

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

It had one real weakness, and Tom asked for it to be addressed here: every block in a cluster got
equal width, and none widened into free space. One short overlap therefore made a whole cluster thin
for the entire day. **Fixed in `libs/components` on 2026-09-10**, with a changeset and the scheduler
guide updated.

### The axis stays 24 hours

Fixed at 8rem per hour, opened scrolled to the first activity. A cropped span would rescale the day,
so the same one-hour meeting would be a different height on Tuesday than on Monday, and a screen that
rescales itself is hard to trust.

### A day starts at a configured hour

**Built.** ADR 0015. Work at 01:00 belongs to the evening it came from. `DayBoundary` is a required
argument on `localDayKey`, `localDayRange` and `byLocalDay`, so a caller that forgets it is a compile
error rather than two parts of the app disagreeing about which day an hour is in. The hour is
`settings.dayStartHour`, edited on the Settings screen.

## Also in this milestone

- **Split and glue. Built.** `PinnedRow.issueKey` and `ReviewedRow.issueKey` are optional, `propose`
  emits every unattributed group as a row, and `reviewDay` shows them. `isNamedRow` is what keeps an
  unnamed row out of every sync, and the compiler finds a caller that forgets it.
- **Two windows of the same application separated by a short gap are one call. Built.** Every Google Meet
  opens the microphone twice, because its pre-join screen runs a device check. Measured on 2026-09-10:
  a 0-minute window at 11:29, then the real call from 11:29 to 11:57. `classifyCalls` now joins two
  calls of one application under `DEFAULT_CALL_GLUE_MS`, which covers a call that drops and
  reconnects as well.

The screen writes local edits to `day_review` and never reaches Tempo.

## Exit test

Tom reads a real day on one screen, and cuts it where he wants it cut. It is a written judgment, and
it is not automatable. **Not yet done.**

Step one's own check was `stream/both-pipelines.spec.ts`, which compared the two pipelines row for
row. With `correlate/` deleted there is no second pipeline to compare against, so it is now
`stream/stream-day-rows.spec.ts` and it pins the same days' numbers directly. The real-day half needs
the screen: the store is encrypted, so no script outside the app can read a day out of it.

## Not in this milestone

No naming beyond what the ladder already does — that is M3. No ticket drafts, no report, no model
call, no anonymiser — that is M4. No booking.
