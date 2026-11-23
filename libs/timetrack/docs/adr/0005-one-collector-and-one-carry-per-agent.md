# One collector per agent, and the parser's session state on the cursor

Codex is the second coding agent the app reads, and its rollout log states per session what Claude
Code states per record. A `token_count` payload names no model, no checkout and no session: those
appear on `session_meta`, which opens the log, and on `turn_context`, which opens a turn. A live read
resumes from a line offset, so it has gone past both. A turn with no model cannot be priced, which
is what slice 5 needs it for.

So two things are decided together.

**The cursor carries the parser's session state.** `agent_session_cursor` gains a `session_json`
column in schema v13, and `AgentSessionCursor.session` holds the session id and the last model the
log named. The parser reads it as `resume.session` and hands back what the batch ends on, exactly as
it already does with `after`, `title` and `cwd`. The host never reads the JSON: the format lives in
the parser.

**Each agent gets a session collector and a spend backfill of its own**, and two passes of its own —
`codex-session` and `codex-spend` beside Claude Code's `agent-session` and `spend`. One agent is one
log format and one set of cursors.

## Considered options

- **Re-read every log from the top on every run.** Always right, and no migration. Rejected on
  measurement: the largest rollout log on this machine is 14 MB across about 1 000 lines, and every
  line would cross the host bridge each minute while Codex runs.
- **Re-read only the log's header on every run.** No migration, and the first `turn_context` is then
  always in view. Rejected: `turn_context` opens every turn, not just the first, so a session where
  the user switched model would price every later turn under the old one, for ever.
- **One collector reading both formats.** Rejected: both collectors write back every cursor they
  read, so a shared pass would let one undo the other's offset — and an agent-session sample has no
  dedupe key, so the re-read that follows appends a second copy of it. See ADR 0003.
- **Rename `agent-session` and `spend` to name Claude Code.** Rejected: a stored cursor under a new
  pass name is a cursor at line 0, and the store holds over a thousand of them.

## Consequences

- The Sources screen keeps one row per event kind rather than one per agent, because the store
  counts events by kind. Each row names both agents where their state differs, and says it once
  where it does not.
- The Host screen counts the cursors of every pass. A pass whose reader lists no log reports that it
  has converged, and only a cursor count separates that from a pass that read everything.
- A third agent is a parser, a reader, two passes and two rows in the Host screen's list. No change
  to the store and no change to the core.
- `resume.cwd` is fed from the existing `cwd` column rather than from the new JSON. The column holds
  that value already, for the resync, and one value with two homes is one value that can disagree.
