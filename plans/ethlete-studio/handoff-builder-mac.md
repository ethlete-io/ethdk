<!-- Builder handoff, Mac 2026-11-10 day shift (ADR 0239). Replace once resumed. -->

# Handoff: builder, Mac (day shift)

Run `/builder-agent` first. The grill/docs session is `ethlete-sdk-68`; report every sha to it with `SendMessage`.
Never ask the user. `export NX_NO_CLOUD=true`. Commits: `git commit -- <paths>` (`git add -- <new file>` first), never
`git add -A`, stash, amend or rebase. At each slice start run `yarn slice:paths "<slice name>" <path>...`. One full test
run at a time. Commit scope for Studio/e2e is `repo`. A slice that changes a config or a `.ts` file runs the `typecheck`
target of each touched project.

## State at handoff

- Push: the human decided (grill session, ADR 0243 draft) to push the whole local range to origin/next with
  `PUSH_SUITE_SKIP=1` and no push:suite. No agent sets that variable; the builder asked the human, through the grill
  session, to run `! PUSH_SUITE_SKIP=1 git push origin next`. Check `git rev-list --count origin/next..HEAD` first. If
  the range is pushed, watch CI and send the run link and result to the grill session.
- Range checks at 979509140: `yarn lint:changesets` passes (979509140 removed the unknown `timetrack-vscode` from two
  changesets); Prettier check on the 79 changed files is clean; the B466 worker cap fix is in the range as c11cc03ac.
- Day-shift commits: a1986d0c0 + 7ea9c9cee (B470 and B472 load runs, no repro under 12 hogs), 4d5031820
  (`--delay-frames <ms>`, design server env `ETHLETE_DESIGN_DELAY_FRAMES_MS`), de8aba7b6 (B470 fix: the Sketches first
  load case ignores the frames of the page before `page.reload()`; Cause bitten with `--delay-frames 3000`), 7d72894fa
  (B471 fix: `fetchpriority="high"` on shot pictures after a camera key switch; Suspect only, HEAD did not miss in 3
  runs).
- Not verified for 7d72894fa: 3 OFF-CENTRE findings (button text 1 px high) from
  `yarn et:design check --product studio --part elements/canvas-frames`. A base check in a worktree refused stale design
  mocks. The check rewrites `.ethlete/design/studio/pictures.json`; only Studio or the human commits it, so restore it.
- Decided (grill session): the "only visible frames live" iframe idea is dropped (ADR 0244 draft). push:suite keeps
  its lint step and gets a typecheck step for the touched projects (ADR 0245 draft). The ADR files are untracked and
  belong to the grill session.

## Then

1. push:suite typecheck step (ADR 0245): run the `typecheck` target of each project the unpushed diff touches, next to
   the existing lint step. Bite it: a type error in a touched project fails the suite, an untouched project is not
   checked. Measure the added wall time.
2. Base comparison of the 3 OFF-CENTRE findings on `elements/canvas-frames` (build `components` first so the mocks are
   fresh).
3. B469 (ADR 0242, CEF on every platform): spike CEF on macOS (build, bundle size, signing, notarization). Read the
   `app-releases` skill first.
4. Iframe perf measurement and a third full `yarn studio:e2e`, only on a quiet machine (load under 4).
