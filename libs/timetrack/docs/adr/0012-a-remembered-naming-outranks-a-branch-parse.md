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

## Consequences

- Rung 7 reads `RecurringPattern` and is dead code today: nothing passes `patterns` to
  `correlateDay`. Wiring it is what makes the store say anything on the first run, before the app
  has been used at all.
- A remembered naming ages the same way a hand-written rule ages. `BD-2049` is called "Intern:
  Meeting 2025" and it is still current in 2026, so the app warns when the ticket a record names
  stops being touched. A record never expires on a date.
- When two rungs disagree, the band shows both and asks. It does not pick the higher one silently.
- A model that invented a pattern from three occurrences would sit at rung 2 and outrank a fact.
  That is why the model proposes and the user accepts, and never the other way round.
- **No meeting, title, weekday or ticket key of the user's may be named in code.** A learned store is
  the whole point: the moment a rule hardcodes one person's routine, the app works for one person.
  Tom's own meetings are fixtures for the tests, in the same way that theme names in the SDK belong
  to the application and never to the library.
