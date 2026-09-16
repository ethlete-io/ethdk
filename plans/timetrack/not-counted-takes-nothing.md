# Not counted takes nothing

Part of milestone M2 in [`roadmap.md`](./roadmap.md), beside [`mind-the-break.md`](./mind-the-break.md).
Written on 2026-09-16, from the same real day, read again at 12:00.

Tom's words: "a not counted slot should not get prio over a background slot."

This is a defect, not a new decision. ADR 0024 already rules that a call a rule excluded claims
nothing. One step of the pipeline does not hold that rule.

## What the screen showed

The day held these bands, in the last quarter hour before the current time:

- `ET-772 · in the background · 15m`, from 11:45 to 12:00, in the `ethlete-sdk` lane.
- `Not counted · 15m`, over the same quarter hour, in the `Calls & meetings` lane.

The work before it reads `ET-772 · 1h 0m`, from 10:45 to 11:45, and it books. The last quarter hour
of the same work books nothing. A voice room the call rules deny took it.

The band from 09:15 to 10:45 is correct. `FIFAGG-12652` is a meeting that counts as work, so the
background band behind it gives way and is drawn as a stretch.

## Why the app drew it

One cause, in the library. `recutReviewedRows` (`review/recut.ts:110`) builds the rows that may take
time from a background row like this:

```ts
const covered = options.rows.filter((row) => !isBackground(row));
```

Every row that is not background covers. A call a rule excluded is not background, so it covers as
well. The background row loses the minutes, and `lostSpansOf` reports them as a stretch.

Two things make this clearly wrong rather than a judgment call:

1. **The first cut already holds the rule.** `buildRows` hands `cutBackground` only the calls that
   count as work (`rows/build-rows.ts:178`), and it says so in the comment two steps below
   (`rows/build-rows.ts:196`). The recut is the second cut, and it reads a different rule.
2. **The row it gives the minutes to books nothing.** The excluded row is `weak`, it stays
   `suggested`, and no sync writes it. So the 15 minutes reach no worklog at all. The day loses them.

The recut already drops a row the reviewer hid (`review/review-day.ts:249`). A row that is not on the
day therefore takes nothing from a background row. An excluded row is on the day and books nothing,
and that case was missed.

## The rule

**A band the day holds as work takes minutes from a background band. A band the day was told is not
work takes none.**

The test is what the band is, and never whether a sync writes it. A `suggested` band is written by no
sync either, and it is work the reviewer has not answered yet. It takes, as it does today.

Two bands are not work, and each says so from a different direction:

- **A call a rule excluded.** The user's rules said the room is not work. ADR 0024 already rules that
  it claims nothing.
- **A rejected row.** The reviewer said this is not work. Answered by Tom on 2026-09-16.

One band books nothing and still takes: **a band nobody was at**. An agent ran the work, so the
minutes really were the foreground of that lane. Answered by Tom on 2026-09-16, and it needs no code
change.

The user can overrule the room. ADR 0024 says a band reads as any other row from the moment it holds
an issue. So the guard on an excluded row is on one with no issue key, and it has the same shape as
`colorTokenOf` (`apps/timetrack/src/app/day-review/row-edit/row-appointment.ts:100`):

```ts
const takesNothing = (row: ReviewedRow) => (row.excluded && !row.issueKey) || row.state === 'rejected';
const covered = options.rows.filter((row) => !isBackground(row) && !takesNothing(row));
```

The two bands then cover the same quarter hour on screen. That is correct, and no warning follows
from it: `overlapMs` of an excluded call is 0 under ADR 0024, so the `meeting-overlap` warning stays
about real double counting.

## Why the snap makes this worse

`snapRowBounds` runs before the recut, on purpose, so a background row gives up whole increments.
Therefore an excluded call that ends at 11:52 is drawn to 12:00, and it takes a full quarter hour
that it never held. This is cause 2 of [`mind-the-break.md`](./mind-the-break.md), in a second place.
The guard above removes it here as well, because a band that takes nothing cannot take a snapped
minute either.

## Rejected and hidden are two different things

Tom asked, and the code says they are. A hidden row leaves the timeline: `hideRow`
(`review/edits.ts:141`) writes `hidden: true`, and `reviewDay` takes every hidden row out before the
recut (`review/review-day.ts:249`). So a hidden row already takes nothing.

A rejected row stays on the timeline and reads as itself. `setRowState` (`review/edits.ts:132`)
writes the state, and the row edit surface writes it from the "will sync" switch
(`apps/timetrack/src/app/day-review/row-edit/row-edit-surface.ts:54`). Today it covers a background
row. Under the rule above it must not, which is Tom's answer for both readings of his question.

## What has to be proven

Unit tests in `libs/timetrack`, in `review/recut.spec.ts`:

1. A background row under a call a rule excluded keeps its minutes. The day reports no stretch for
   it.
2. The same row, under an excluded call the user named, gives the minutes up and reports the stretch.
3. A background row under a meeting that counts as work still gives way. This is the day above from
   09:15 to 10:45, and it must not change.
4. A background row under a rejected row keeps its minutes.
5. A background row under a `suggested` row gives way, as it does today. No sync writes either of
   them, and the rule must not read that as a band the day was told is not work.
6. A background row under a band nobody was at gives way, and the day reports the stretch.
7. An excluded call whose end snaps forward by a few minutes takes nothing.

One e2e flow under [`e2e-strategy.md`](./e2e-strategy.md): seed a day with a background checkout and
a denied voice room over its last quarter hour. Open Day, and check the work lane holds one row of
the full length and no stretch behind it.

Every test must fail without its fix. Write the test first and watch it fail.

## Not in this

- No change to ADR 0024. The rule stands; this makes one more step hold it.
- No change to the first cut. `cutBackground` is already right.
- No change to how an overlap is drawn. Two bands over one quarter hour is what lanes are for.
