# An event belongs to the machine that collected it

M7 merges the days of several machines of one user (`plans/timetrack/m7-sync-research.md`). On
2026-10-08 the PC was off until 19:26 while the MacBook carried the whole workday, and the PC read
the MacBook's commits as its own work. A merge has to know which machine saw an event, has to send a
machine only what it has not seen, and has to count a fact two machines both hold once.

Today none of that is possible. An event row does not say which machine collected it. Its `dedupe_key` is unique across the
store, and some keys hold a machine path (`git-commit` keys by `repoPath`), so a peer's copy of the
same commit keys differently. Two local paths rewrite or delete rows in place: `append_replacing`
upserts a commit, a calendar event or an agent row, and deletes the calendar events and agent
sessions a re-read no longer returns. A cursor over row ids would miss all of those.

**Each machine has an id, and the events it collected stay its own.** Migration 20 gives the store
a random machine id (`machine`). The events this machine collects stay in `collected_event`, with
every write path unchanged. A peer's events go into a separate `received_event`, keyed by
`(machine_id, peer_row_id)`: the peer's machine id and its own row id. A received row keeps the
peer's `dedupe_key` as it was written, unique per machine, so two machines never collide on a key and
no stored key has to change its spelling.

**A machine serves only its own events, by change, not by row.** Every insert or update of a
`collected_event` row takes the next value of the store's change counter into `changed_seq`, and a
delete leaves a tombstone with the next value. Triggers set both, so no write path can forget it. A
peer pulls "changes after my cursor" for its machine and applies the upserts and the tombstones. A
machine never relays another machine's events: each pair talks directly.

**Two copies of one fact are folded when a day is read, not when they are stored.** The core reads
both tables and folds copies by the fact they share: the commit sha, the prompt and turn ids, the
merge-request event id, the calendar occurrence. For a commit the copies are not equal. The machine
whose reflog wrote the commit holds the copy that describes the row. A machine that pulled it holds
presence at the pull and no subject (ADR 0018). Both facts are true and the merge needs both, so
neither copy may overwrite the other in the store.

**A repository is one stream on every machine.** The stream key is the normalized `origin` URL of
the checkout: host and path, lower-case, without scheme, user, port, `.git` and trailing slash, so
`git@gitlab.com:Ethlete/sdk.git` and `https://gitlab.com/ethlete/sdk` are one key. A checkout with no
`origin` keys by its directory name, and a manual alias overrides both. Each machine sends its own
map from path to key with its events, and a rule or a project link matches a peer's event through
that map. Until a merge exists (slice 4) the key changes nothing, so `streamKey` stays a path.

## Consequences

- A copy of the store on a second machine carries the same machine id. Pairing refuses a peer with
  this machine's own id.
- Retention deletes both tables by event time. A tombstone older than the retention cut is dropped,
  because a peer drops the row it names by the same rule.
- The calendar refresh and the agent-session re-read keep deleting only this machine's rows. A peer's
  calendar copy leaves with the peer's tombstone or with retention.
- Spend stays with the machine that collected it (ADR 0002): a received `agent-usage` row is never compacted here.
- The read fold costs a pass over the day. A day holds a few thousand events at most.
