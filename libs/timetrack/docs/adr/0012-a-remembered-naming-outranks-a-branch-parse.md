# A remembered naming outranks a branch parse

Most of Tom's day books to a standing ticket rather than to a ticket for the work, and two of his
four weekly meetings appear in no calendar at all. Nothing in the ladder can name those. The obvious
repair is a screen where the user writes rules. Tom rejected it: the system has to learn from his
use and adapt, not be configured by hand.

There is one store, a **remembered naming**, and three writers. Tempo history seeds it, because
`RecurringPattern` already carries an issue key, a weekday, a start minute, an end minute and a
count — the exact shape needed. A naming of Tom's writes to it and outranks the seed. An accepted
model proposal writes the same record a naming writes, because the user accepted it. A model never
writes to the store directly.

It keys on the application, the weekday, a duration band and **the event that ran before it**. That
last feature is a relation rather than a property, and it is the only one that describes Tom's
Monday call, which has no fixed clock time and starts when the preceding meeting ends. The clock
time is held as a weak tiebreak only.

The rung sits **second**: under the private project link, above the branch grammar. A correction of
the user's has to beat a parsed branch, or correcting the app achieves nothing. Its confidence comes
from the record rather than from the rung: a naming of the user's returns `certain`, a Tempo seed
with many occurrences returns `likely`, and a thin seed returns `weak`. So a seed placed that high
still loses to the `certain` a branch parse gives.

**That rung is the call and meeting ladder's**, `matchOne` in `rows/calls.ts`, and this ADR decides
nothing about the work-block ladder in `rows/attribute.ts`. The two are not the same ladder and the
remembered store has no writer on the work side: naming a work row writes a day-local override, and a
standing answer about a checkout is offered rather than learnt — ADR 0025. So an `AttributionRule`
sitting below the branch grammar in `attribute.ts` is not this decision being broken. Where a rule
should sit against a parsed branch is an open question, and it is open on paper only: a branch that
parses already states its key, so the rungs below it are reached only when the grammar named nothing.

## Consequences

- The Tempo seed is wired: `injectRecurringPatterns` reads it and the day store passes it as
  `MeetingOptions.patterns`, which is what makes the store say something on the first run, before the
  app has been used at all.
- **A naming of the user's is keyed on the calendar series, not on the feature set above.**
  `meetingSeriesKey` reads the provider's `recurringEventId`, and folds the title for a one-off
  event. That keeps the answer through a rename and asks once per series, which is what ADR 0010
  needs. The application, weekday, duration band and preceding event this ADR describes are the
  **second** key, for a call the calendar never held: `CallFeatures` and `matchCallNaming`. The
  application and `after` ended up as gates rather than scores, because a record about the call that
  follows one thing says nothing about a call that follows another. The clock is a scored feature as
  well as the tiebreak, which is what names a call that always stands alone and has no `after` to be
  keyed on.
- The writer is `DayReview.setIssue`: naming a row in the call lane traces the row back to its
  occurrence through `meetingBehindRow`, and back to the call itself through `callBehindRow` when the
  calendar named no occurrence. Naming any other row writes nothing.
- A remembered naming ages the same way a hand-written rule ages. `BD-2049` is called "Intern:
  Meeting 2025" and it is still current in 2026, so the app warns when the ticket a record names
  stops being touched. A record never expires on a date. What is read is the issue's own `updated`
  field, through `fetchJiraIssueTouchedAt$`, and a key Jira answered nothing for is left alone: a
  missing token and a dead ticket read the same from here, and only the second is worth a warning. A
  worklog this app writes goes to Tempo rather than to Jira, so booking to a ticket cannot keep it
  looking alive. `aged-naming` is raised only on a day that books the record, so the warning names a
  band the reviewer can find — ADR 0026.
- **A `likely` calendar pick loses to an answer of the user's about this call.** `matchOne` clears
  the picked occurrence when `matchCallNaming` returns `likely`, which leaves the row with no meeting
  behind it and keeps the answer readable. A `certain` pick still wins, because a window title seen during the
  call named the occurrence outright, and that is an observation rather than a guess. Without this,
  the call with no fixed time books to whatever single meeting happened to be accepted over it that
  week, and the answer given for the call is never read.
- When two rungs disagree, the band shows both and offers the one that lost. It books the higher one
  and never picks it silently.
- A model that invented a pattern from three occurrences would sit at rung 2 and outrank a fact.
  That is why the model proposes and the user accepts, and never the other way round.
- **No meeting, title, weekday or ticket key of the user's may be named in code.** A learned store is
  the whole point: the moment a rule hardcodes one person's routine, the app works for one person.
  Tom's own meetings are fixtures for the tests, in the same way that theme names in the SDK belong
  to the application and never to the library.
