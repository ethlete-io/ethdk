# An attended call is presence

Tom, on 2026-09-16, reading a day the screen drew a break over a meeting: "breaks should be ediable
/ remove and restoreable. also they should be a little smarter."

The meeting ran 90 minutes and nobody typed in it. `presenceWindows` reads presence from
`window-focus` and `agent-prompt` samples alone, so the meeting opened a gap, and `breakGaps` read
the gap as a break. A person in a meeting is not away from the day.

`streamDay` already unioned the calls into presence. It took `countsAsWork`, which answers a
different question.

## Two questions, one field

`countsAsWork` is the attendance gate **and** the work rules together. The work rules say what a room
usually is. They say nothing about where the user was:

- A meeting no rule names books nothing, and the user still sat through it.
- A room the user named by hand books its minutes, and the name says nothing about the microphone.

So `CallWindow` now carries `isPresence` beside `countsAsWork`. It is the attendance gate, less the
rooms a rule marks `neverCountsAsWork`. `streamDay` reads it for `presence` and for `seen`;
`countsAsWork` keeps every job it had.

ADR 0024 already stated the rule this follows: "An open microphone is not a person at the machine —
that is the whole reason `classifyCalls` gates on attendance." The gate was there; presence read the
wrong field.

## The exception stays

A room a rule marks as never work is the open Discord room, and it is the one call that says nothing
about where the user was. It holds no presence, and a break inside it survives. Attendance drops most
such rooms on its own: measured on 2026-09-10, the rooms held the focus far less than the meeting
did. The rule is the escape hatch for the rest.

## Consequences

- `presenceMs`, `rebuiltMs` and the engagement ratio all rise on a day with a meeting no rule names.
  A call is watched time, not rebuilt time, so the ratio keeps its meaning.
- What a call **claims** does not move. `fillGaps` and `markAttendance` still take only the counted
  calls, so ADR 0024 stands: a room vouches for no band around it.
- A break the snap still pushes into a meeting is a second defect, and this ADR does not cover it.
