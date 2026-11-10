<!-- Builder handoff, Mac night shift 2026-11-10 (ADR 0239), fifth session. Replace once resumed. -->

# Handoff: builder, Mac night shift (ADR 0239)

Run `/builder-agent` first. The grill/docs session is `ethlete-sdk-68`; report every sha to it with `SendMessage`.
Never ask the user. `export NX_NO_CLOUD=true`. Commits: `git commit -- <paths>` (`git add -- <new file>` first), never
`git add -A`, stash, amend or rebase. Write the slice paths to `$(git rev-parse --git-path slice-paths)` yourself at
each slice start. One full test run at a time. Commit scope for Studio/e2e is `repo`.

## State at handoff

- No push tonight (grill decision). CI red is B466 on origin/next; its fix waits for the human (B471, worktree
  `/tmp/b466-push`). No agent sets PUSH_SUITE_SKIP.
- Commits this session, all reported to the grill session and recorded by it: e370bba6c (679 event log), c009a879e
  (revert of the 995491fb1 warm-up), 82369780d (667 c shared shot store), 04eb763dc (parent-watch lint), 9e2572e8c (684
  Suspect/Cause rule in the skills), cef57a3d0 (685 lint at commit and in push:suite, 663 ensureCli rebuilds a stale
  dist), 212a131f6 (667 a shared in-flight draw lock), 8f45fbb32 (667 b remove old `shots-<10 hex>` folders),
  494fd4f4f (678 listing hold reasons).
- Full `yarn studio:e2e` at 9e2572e8c: 131/131 in 410.9 s (was 442.2 s). No full run after 212a131f6.
- `plans/ethlete-studio/design-to-code.md` has a size budget (440k). The grill session owns it and archives findings;
  subagents add short As-built notes only.
- Tree clean. No subagent, e2e or design server running.

## Then (order set by the grill session)

1. 656 + 658 (one slice, both `tools/scripts/push-suite.mjs`): 656 the suite imports its gate scripts from the live
   tree, so an uncommitted edit leaks in (load them from the exported HEAD dir); 658 `failureReport` also prints the
   vitest `FAIL <file> > <test>` rows. Findings at about line 3450 and 3496.
2. 660 (Mac git regex dialect, a check that pins it), 662 (`maxWorkers` follows core count; B466 suspect, CI red), 672,
   670 + 682 (slice-paths file names the slice and its time, "stale" past 2 h). Read each finding first; skip parts
   whose As-built says done.
3. A second full `yarn studio:e2e` on a quiet machine for spread (compare 410.9 s and 442.2 s).
4. Iframe perf measurement only on a quiet machine: live iframes, memory/CPU per iframe, open-to-all-painted,
   visible-only variant without a product change; figures to the grill session.
5. Day-shift handoff: note B469 (ADR 0242, CEF on every platform; Mac spike is day shift, not night).
