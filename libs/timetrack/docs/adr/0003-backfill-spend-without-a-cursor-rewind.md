# Backfill spend with a read from the top, never with a cursor rewind

Spend collection started after months of agent logs had already been read, so the stored days hold
no spend. To fill them, a backfill pass reads every agent log from the first line and appends only
`agent-usage` events. It never moves an agent-session cursor.

A rewind would be the obvious move, and it is unsafe. An `agent-session` event has no dedupe key —
`dedupeKeyOf` returns `null` for it, and two identical focus-like samples a minute apart are two
real observations — so a log read again from the top appends a second copy of every sample in it.
`resyncAgentSessionCursors` already says so in its own doc comment, and it rewinds one log at a
time for that reason. A spend event does have a key (`provider` and `turnId`), so appending spend
twice is free.

## Considered options

- **Give `agent-session` a dedupe key** of session id and instant, then rewind wholesale. Rejected:
  the sample thinning depends on where a read started, so a full re-read produces a different
  sample set rather than the same one. A key would not stop the duplication, and a wrong rewind is
  hard to undo once it is in the store.
- **Replay outside the store**, in a spec or a tool. Rejected: it makes the Today screen's exit
  test a test of a fixture, not of the application.

## Consequences

- The backfill gets its own cursor, so it converges instead of a re-read of 606 logs at every
  launch. It is a `kind` column on the existing `agent_session_cursor` table, with `agent-session`
  and `spend` as its values, and the primary key becomes `id` and `kind`. A second table would be
  the same migration and would invite the two passes to drift apart, when they are one mechanism.
- It runs automatically in the background, and its state shows on the Sources screen. A backfill
  behind a button gets forgotten, and then a day reads zero spend for a reason nobody remembers.
- The Rust log enumeration must reach subagent logs first, or the backfill misses them and has to
  be run twice.
