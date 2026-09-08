# Spend outlives the raw events it was collected with

Retention deletes raw collected events once compaction has turned them into blocks, on a 30-day
window. Spend events (`agent-usage`) are exempt: they are kept per day and per stream, past the
raw-sample window.

A raw sample is one observation among thousands, and a block replaces it losslessly enough. A
spend row is not replaced by anything: it is already an aggregate with no content, and the agent
log it came from rotates. Deleting it destroys cost history that cannot be rebuilt, which is
exactly the history the price table and the week report exist to read.

## Status

Accepted. Not built. Nothing calls `planRetention` and nothing calls `deleteEventsBefore$` today,
so no event has ever been deleted. The Rust command `events_delete_before` deletes by instant with
no source filter, and it needs one before compaction ships. This ADR exists so that the filter is
written when compaction is, rather than discovered after the first deletion.

## Consequences

- A spend row holds no prompt, no message body and no file name. That is what makes a longer life
  safe, and it must stay true: spend is a count, never evidence.
- The store's delete path becomes per source. The schema already lifts `source` out of the
  payload, so the filter is a `WHERE` clause, not a migration.
