# One piece of work is one row

This ADR records decisions the human made on 2026-09-22 and 2026-09-29, taken from the plan `one-session-one-piece.md`
before that file was trimmed to its open items (ADR 0352). Related: ADR 0034 and ADR 0036.

- The agent session is the finest grain of a stand-in. A branch switch or an accepted merge request is not a cut of
  its own.
- Sessions that did one piece of work belong on one ticket. The session cuts and a piece joins, so a day never turns
  into one stand-in per session. A piece's identity across days is its directory, not its session id, so stored rules
  keep matching `repo@branch#workPath`.
- A piece joins by evidence: sessions that wrote the same named work file (a handoff, a plan file, a design call) join
  even when they ran at the same time. A code directory joins only a session that starts after the piece ended.
  Parallel sessions stay apart unless a named work file joins them.
- Parallel sessions on one ticket are drawn side by side in the lane, never stacked below each other. Tempo gets the
  wall clock once: the shared minutes are split by focus, and a row books its own observed minutes, rounded up to the
  increment, not its span. At most three parallel rows of one ticket show; the shortest folds into the longest.
- The auto description of a row settles 30 minutes after the end of its own piece's last activity, not after the row's
  end.
