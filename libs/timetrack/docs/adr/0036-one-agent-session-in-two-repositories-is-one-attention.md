# One agent session in two repositories is one attention

On 2026-10-01 the `specs` lane booked 12:15 to 13:15, 60 minutes on 35 observed, and every one of
those minutes was booked again in the application lane beside it. Three agent sessions had been
started in the application's checkout and wrote their specs into the sibling repository. The
application's band ran 10:30 to 15:30 straight through.

`fileAgentEventsByWork` files a session's event under the checkout its tool call touched, so the
session drew a band in each repository. Each band runs from that checkout's first event to its last
and bridges the gaps between them, so a session that went to the specs and came back held both
lanes over the same minutes. ADR 0034 left two repositories that are not worktrees of each other as
two things at once, and nothing decided the case where one session is both of them.

Tom decided it on 2026-10-01. **An instant that one agent session holds in two repositories goes to
the repository its tool calls touched at that instant.** The other repository records it as
`behind`, the way ADR 0034 records a worktree's lost minutes.

"Touched at that instant" is read off the session's own records that carry `workedIn`: the
repository holding the path the last such record before the instant names. It holds until the next
record names the other one. Before the session's first such record the instant goes to the
repository of the session's oldest band.

What stays two things at once:

- Two different sessions in two repositories. Each is its own attention, and `concurrency` measures
  the day that ran both.
- A person and an agent. A repository whose window held the focus at the instant keeps it, whatever
  the session there was doing elsewhere.
- A checkout and its own linked worktree. ADR 0034 already resolves those by the focused window.

## Consequences

- `cutSessionAcrossCheckouts` runs before `cutUnwatched`, on the attributed blocks.
- A band of the repository the session left is not drawn across a stretch it handed over that is at
  least `minBandMs` long, in `mergeBlocks` and again when `reviewDay` folds a short row. A row books
  its span (ADR 0019), so cutting the blocks alone would have left the band booking the same minutes.
  The same holds when both repositories book one ticket: the other repository's block over that
  stretch does not continue the band by name.
  `DayRows.handedOver` carries those stretches to the review.
- A stretch the lane still books draws no strip: `reviewDay` takes the minutes a row of the same lane
  covers out of each strip, after the rows are snapped.
- A person who watches the agent's terminal in one repository while it edits the other books that
  minute in both. Tom kept the focus rule on 2026-10-01 regardless: focus is the only sign of a person
  the cut has, and dropping it would cut a person's own editor time too.
- A shorter stretch is still cut from the blocks, so it no longer counts as observed in the repository
  the session left. It does not split that repository's band.
