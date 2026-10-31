# Parallel backlog - rules for every stream

## Rules for every stream

- One subagent per stream, run the streams at the same time. Inside a stream, work serially: its items touch
  the same files.
- Each stream commits only its own paths (`git add -- <new files>`, `git commit -- <paths>`). Never `git add -A`,
  stash, amend, reset or `checkout --`.
- A typecheck or build error in another stream's uncommitted file is not yours: check your own files with tsc and
  eslint on changed files, and say so in the report.
- Every lib change: a spec that bites, a changeset, docs (`apps/docs/cli/index.md`), no new lint warnings.
- Record each item as built in its plan section, with the commit.
- **`ready` means final (Tom, 2026-10-30).** A sketch goes to `ready` only when no change to it waits on
  anything: no open decision, no landing helper, no "once X is decided I adapt the sketch". While such a change
  is pending, the sketch stays in work and is not in the merge queue. Put the open question to Tom first, change
  the sketch, then mark it `ready`. A sketch that is `ready` and then gets such a pending change leaves the queue
  until the change is in.
