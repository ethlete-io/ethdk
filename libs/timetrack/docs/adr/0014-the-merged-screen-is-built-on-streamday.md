# The merged screen is built on streamDay, and correlate/ is deleted

The day timeline is fed entirely by `correlateDay`. `store.rows()` traces through `reviewDay` and
`reasoned` to `correlateDay` (`apps/timetrack/src/app/day-review/day-review.ts:294`), and `streamDay`
feeds it nothing. `streamDay` also produces nothing row-like: a `Stream` carries `blocks:
TimeWindow[]` with no issue key, description or confidence, and no code anywhere builds a
`WorklogProposal` from a stream.

ADR 0011 makes a band a row, so the merged screen needs rows, and today rows exist only in the v1
pipeline. ADR 0007 says the v1 code is replaced per route as v2 takes each one over, and merging the
two day screens **is** taking over the day route. Building the screen Tom called the product on top
of the pipeline with a delete date would build it twice.

So `streamDay` gains the proposal builder, and `correlate/` goes. ADR 0004 rules out the cheap middle
path: `stream/` may not import `correlate/`, so there is no version where the new screen quietly
borrows the old builder. Tom's decision, on 2026-09-10: "v1 can move into the trashcan. we can and
should rebuild it into something that actually works."

## Consequences

- The port is most of the milestone, not a detail of it. `correlateDay` reads editor, calendar and
  GitLab events that `streamDay` never sees, and it holds the timer matches, the pauses, the meetings
  and the unattributed blocks. All of that moves.
- The milestone runs in two steps. Step one ports the pipeline with no screen change, so it is
  testable against the screen that exists. Step two draws the merged screen on it.
- The drift ADR 0007 measured is the argument, not a footnote: `stillFocused`,
  `windowsSeenThroughMs` and `ownAppIds` live in `streamDay` and in no part of `correlate/`. Every
  day the v1 screen is kept alive, it reports a still focus as unobserved time.
