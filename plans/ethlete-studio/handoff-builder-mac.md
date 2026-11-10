<!-- Builder handoff, Mac night shift 2026-11-10 (ADR 0239), fourth session. Replace once resumed. -->

# Handoff: builder, Mac night shift (ADR 0239)

Run `/builder-agent` first. The grill/docs session is `ethlete-sdk-68`; report every sha to it with `SendMessage`.
Never ask the user. `export NX_NO_CLOUD=true`. Commits: `git commit -- <paths>` (`git add -- <new file>` first), never
`git add -A`, stash, amend or rebase. Write the slice paths to `$(git rev-parse --git-path slice-paths)` yourself at
each slice start (finding 682: a stale file warns wrongly). One full test run at a time. Commit scope for Studio/e2e
is `repo` (commitlint rejects `ethlete-studio`).

## State at handoff (2026-11-10 night)

- Nothing pushed tonight; decided by the grill session: no push tonight. 62 local commits on next past origin/next.
- B466 proof: worktree `/tmp/b466-push` at 11de10881 (origin/next + c11cc03ac). Its push:suite was blocked by the e2e
  case `[System] page switch time ...` (B471). Option "push with PUSH_SUITE_SKIP=1" goes to the human in the morning
  round; keep the worktree. No agent sets PUSH_SUITE_SKIP.
- Local commits this session: 054fb039b (674 hold check, `listingMayPend`), a45458424 (B464 visible edges),
  220e4d6b5 (B468 paint wait + navigation detail + `[design] vite full-reload` log), 8a473386c + 46fbda9b2 (673 parent
  watch, proven: exits ~6.4 s after parent kill -9; stale-server warning only for this checkout), 1ac3df506 (B470
  aborted request detail), 1cc2d2ee8 (681 quiet tail: `quiet: true` cases last on worker 0; fail rows print load),
  150c2cbe1 (B472: build order already held; tail no longer restarts idle workers; full run 442.2 s 131/131).
- 683 cause (grill corrected): first-wave cold design servers, not build overlap.
- No subagent runs. Tree clean. No e2e or design server process left.

## Then (order set by the grill session)

1. NEXT: warm-up slice (finding 683, B472): one warm-up page render per design server before its first case. Bite: a
   cold server fails the 10 s goto under the same load, a warm one passes. Report the wall-time cost.
2. (c) 679 backlog: every count-only case in canvas.e2e.mjs prints its events on failure (inventory first, one shared
   recorder/formatter); bite on two cases; also re-bite the B470 case with the src flip (about:blank initiator whole).
   Commit `test(repo): Print the events behind each count in the canvas cases`. Started twice and stopped with no
   edits; start it fresh.
3. 684 tool fix (small): in `.agents/skills/builder-agent` and `.agents/skills/doc-agent`, a finding writes "Suspect:"
   until a bite or measurement proves it, "Cause:" only after; reports name which.
4. A second full `yarn studio:e2e` on a quiet machine for spread (compare 442.2 s).
5. 678: `listingMayPend` takes a reason string; runner summary lists opt-out cases per check; bite proof runs each
   opt-out case once with the hold on.
6. Bug queue: 656, 658 (failureReport prints vitest FAIL rows), 663, 660, 662, 650/659, 670+682 (slice-paths file
   names slice and time, "stale" past 2 h), 667 part (c).
7. Iframe perf measurement (grill request) only on a quiet machine: live iframes, memory/CPU per iframe,
   open-to-all-painted, visible-only variant without a product change; figures to the grill session.
8. Day-shift handoff: note B469 (ADR 0242, CEF on every platform; Mac spike is day shift, not night).
