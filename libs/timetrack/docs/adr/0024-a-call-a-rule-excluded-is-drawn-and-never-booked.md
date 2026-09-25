# A call a rule excluded is drawn and never booked

Tom, on 2026-09-14, on a Discord room his rules deny: "it would be nice to still record it as a
meeting but exclude it. just to have it as a blueprint in case something 'meeting worthy' happened
during that time."

`TimetrackCallRules` says what a room usually is. It cannot say what happened in it today. A voice
room the user sits in all week is not work in general, and once in a while it is the call that
decided something. Until now `matchCalls` dropped a denied call outright, so the one day it mattered
the reviewer had nothing on screen to turn into a row — the minutes were gone by the time the
question came up.

## The row exists and books nothing

A denied call becomes a band in the call lane like any other, carrying its label and the evidence
line that says no rule counts it as work. It differs from a counted call in every other way:

- It is named nothing. No calendar occurrence, no remembered answer and no Tempo pattern reaches it.
  Naming a band a rule excluded would be a guess at work the user already said is not work.
- Its confidence is `weak`, so `defaultState` leaves it `suggested` and no sync writes it.
- Its `overlapMs` is 0. A row that proposes nothing proposes no minute twice either, so the
  `meeting-overlap` warning stays about real double counting.

## It claims nothing either

`WorkGroup` carries `bookable`, and a group that sets it is taken at its word by `isBookable` ahead
of the lane rule of ADR 0020. A denied call is therefore outside `unattributedMs` and outside
`unattendedMs`: it is not time the day is short of, and the footer does not ask the reviewer to name
it.

For the same reason it stays out of the `claimed` windows that `fillGaps` and `markAttendance` take.
An open microphone is not a person at the machine — that is the whole reason `classifyCalls` gates on
attendance — so a room must not vouch for the bands around it.

## It reads as its own thing on the day screen

The band carries `excluded` onto the proposal, and the timeline paints it in the `neutral` theme and
calls it **Not counted**. The warning theme every weak row takes would say the reviewer has something
to settle here, and the rules already settled it. Naming the band is the user overruling the rule, so
from the moment it holds an issue it reads as any other row.

## Consequences

- A call that overlaps a meeting the user accepted counts as work although no rule names it, because
  the acceptance says what the rules would have (2026-09-25, a Slack huddle over the daily). Only
  `neverCountsAsWork` still excludes it.
- A room open for hours draws one long band that books nothing. That is the point: it is the shape of
  the day, and the reviewer can cut a row out of it on the day it held a meeting.
- `too-many-rows` counts it, as ADR 0020 already decided for every drawn row.
- `dropCallWindows` still cuts only for a counted call, so the application's own bands stay beside an
  excluded room. The day says both things it observed: the microphone was open, and the window was in
  front.
