<!-- Builder handoff, Mac 2026-11-10 morning (ADR 0239), after the sixth night session. Replace once resumed. -->

# Handoff: builder, Mac (day shift next)

Run `/builder-agent` first. The grill/docs session is `ethlete-sdk-68`; report every sha to it with `SendMessage`.
Never ask the user. `export NX_NO_CLOUD=true`. Commits: `git commit -- <paths>` (`git add -- <new file>` first), never
`git add -A`, stash, amend or rebase. At each slice start run `yarn slice:paths "<slice name>" <path>...`. One full test
run at a time. Commit scope for Studio/e2e is `repo`. `yarn commit` runs no spec and no typecheck: a slice that changes
a config or a `.ts` file runs the `typecheck` target of each touched project.

## State at handoff

- No push (grill decision). CI red is B466 on origin/next; its fix waits for the human (B471, worktree
  `/tmp/b466-push`). No agent sets PUSH_SUITE_SKIP.
- Commits of the sixth night session, all reported to the grill session: 5d6078461 (B471 cause), 66df9d82a (656 push-suite runs from its export,
  658 vitest FAIL rows), ed5d4ed8c + 28ba414d2 (660 git regex dialect spec), d906c4796 + ef646f413 (662 shared vitest
  worker preset `tools/vitest/workers.mjs`, check in `yarn test:tools`), 0ecf33e8b (670 + 682 `yarn slice:paths`,
  source and age in the warning), 465f8f69e (686 timetrack-app `test` target, 18/18 specs), b7b0a37e6 (skill sentence).
  672's tool part was already in 054fb039b.
- `nx affected -t typecheck --base=origin/next` at b7b0a37e6: 19 projects, 0 errors.
- Full `yarn studio:e2e` at 28ba414d2: 131/131 in 418.3 s, load 12-17 from outside the run, so no clean spread figure
  (earlier: 410.9 s, 442.2 s).
- Open for the human (grill session asked, finding 687/688): typecheck step in push:suite versus a draft-PR push per
  slice (ADR 0038, ADR 0216). The lint step of 685 stays until the answer. Do not add a typecheck step before it.

## Then

0. Queue from the grill session after the restart, in this order (ADR 0230 flake priority, cause first, no fix that
   costs wall time without a bite per ADR 0240, no push:suite round), facts per item to the grill session:
   1. B471 / 681 fix, perf scope. Cause (0e1d59984, 5d6078461): Chromium holds back off-viewport pictures, 2-3 on the
      wire. Try first: high fetch priority only for the frames of the current page switch. Else: the design server
      answers the newest view first. Bite each against `system->icons` 3/3 and the page switch case, under the hog
      load with `--cold-shots`, and measure the wall time.
   2. B470 / 680, first-load aborts: read the printed URL/time/trigger detail from any run log that has it (the 680
      print is in since 1ac3df506); else one targeted run of the Sketches case "first load creates one iframe per frame
      and aborts no frame request", with `--cold-shots` and load. Write "Suspect:" until a bite.
   3. B472 / 683, `Fit is stable` `page.goto` timeout: no proven cause after the 995491fb1 revert. Same rule.
1. B469 (day shift, ADR 0242, CEF on every platform): spike CEF on macOS (build runs, bundle size, signing and
   notarization), then the human confirms the switch to CEF everywhere. Read the `app-releases` skill first.
2. Iframe perf measurement, only on a quiet machine (load under 4): live iframes, memory/CPU per iframe,
   open-to-all-painted, visible-only variant without a product change; figures to the grill session. Not done: the
   machine was at load 12+ all morning.
3. A third full `yarn studio:e2e` on a quiet machine for the spread.
