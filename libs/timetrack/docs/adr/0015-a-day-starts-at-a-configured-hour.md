# A day starts at a configured hour, not at midnight

`streamDay` builds one local calendar day. Work from 22:00 to 02:00 therefore becomes two days, and
the second is a two-hour Tuesday that describes nothing a person did. Tom works past midnight often
enough to raise it unprompted, and his words on the current workaround: "tempo is super tedious to
use for that."

So a day starts at a configured hour, for example 04:00. The screen, the totals, the naming and the
booking all obey it, and work at 01:00 belongs to the evening it came from. The alternatives both
cost the user something: keeping midnight and drawing the neighbouring hours as context leaves the
totals wrong, and asking each time a band crosses midnight is a question the app should be able to
answer by itself.

## Consequences

- The boundary has to reach every day-keyed thing at once: `day_review`, the coverage store and the
  input to the pipeline. Two parts of the app that disagree about which day an hour falls in is worse
  than the problem this solves.
- Tempo keys a worklog by a date. Whether one worklog may start at 23:30 and run 2.5 hours is
  unverified. If it may, the app writes one row. If it may not, the app splits at midnight itself, so
  the user never does. Either way the split is never the user's work.
- A day is no longer interchangeable with a calendar date anywhere in the app. Any code that derives
  one from a `Date` by truncation is wrong under this rule.
