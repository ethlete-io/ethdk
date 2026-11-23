# Process

How the doc session and the builder work. A process change edits this page.

## Roles

- One doc session talks to the human (German) and keeps the queue. One builder builds.
- The builder uses at most two subagents at a time, a fresh one per slice.
- Only the doc session orders the queue. The builder takes the first open row that can move without the human; if none can, it takes a row marked "Füllarbeit", then a parked row. An empty queue never stops it.
- The builder reports only to the doc session, in batched messages.

## Queue

- `plans/QUEUE.md` holds every open row, at most 15. A row: ID, name, goal in one sentence, state, owner.
- A finished row is deleted in the commit that finishes it. Git keeps the history.
- A 16th row needs one row dropped or parked first. Parked rows are one line at the end of the file.

## Proof

- A fix counts only with a test that fails without it on the reported real case, and a shot of that case.
- Without both, the report says "not verified" and the commit is not a `fix`.
- A finding says "Suspect:" until a bite or a measurement proves the cause, then "Cause:".
- No smoke run, e2e or Studio check in pre-commit or pre-push.

## Fixes

- Fix the cause. A new check, gate, hook, cache or lock is never the default fix.
- Two failed repairs: revert to the last good state.
- Red CI is first, before every other row.

## Git

- CI is the only push gate; the builder pushes after each finished row.
- `git commit -- <paths>`; never amend, stash or rewrite history.
- What was built lives in the commit message, not in a plan file.

## Decisions

- A decision of the human becomes a test with a one-sentence comment, or a tool: a live check while the agent writes, or a generator for the base of a sketch the agent then extends. No ADRs.
- Before a question to the human, search the tests and this page. A repeated question is a defect.
- Every question has a recommendation. How a thing looks is never a question: the builder builds its pick.

## Rules about rules

- A new rule on this page deletes an old one. The page stays at about 40 lines.
- The role skills hold only what is not on this page, about 30 lines each.
