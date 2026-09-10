# A call is the fact, the calendar is a candidate list

`matchMeetings` builds a row out of every accepted calendar occurrence. Tom holds overlapping
invitations and attends one of them, so that emits two false rows on a normal morning. The calendar
records an intention. Only the microphone records that a meeting happened.

The order inverts. A `CallWindow` already carries the interval, the application and the window
titles seen while it ran. The call is therefore the fact, and the calendar offers every occurrence
that overlaps it. One candidate is picked, in this order: a window title seen during the call that
matches an occurrence title, or a conference id in such a title, is decisive and returns `certain`;
the application rules candidates out, because a Discord call is no Meet occurrence; a single
remaining candidate that was accepted returns `likely`; nothing else decides, and the band stays
unnamed with its candidates listed.

**An accepted occurrence with no call observed proposes nothing.** It becomes a question, never a
row. That holds the promise that this app never invents time it did not observe, and it is also the
honest answer for a meeting held in a room or on a telephone.

## Consequences

- The real start comes from the microphone. Measured on 2026-09-10: a calendar occurrence at 11:30
  was observed as a call from 11:29 to 11:57.
- A Google Meet opens the microphone twice. Its pre-join device check produces a window of a few
  seconds, then the real call follows. Two windows of the same application separated by a short gap
  are one call, which also covers a call that drops and reconnects.
- The decisive title is the one seen **during** the call, from `titlesDuring`. `CallWindow.title` is
  the title the application held _before_ the call opened, and for a browser that is the application
  name, not the meeting name.
- A call with no calendar occurrence at all can still be named, but only by a remembered naming
  (ADR 0012). Two of Tom's four weekly meetings are of that kind.
