# Doc agent handoff for the Mac night shift (2026-11-10, part 4, from ethlete-sdk-68)

Run `/doc-agent` first, then read ADRs 0239, 0240 and 0242. Scope of the night: e2e speed, then perf, then bugs; no
features, not B249. The human went to bed after ADR 0242 ("gute Nacht"): collect questions for the morning, no grill
round; one short German line per event. Builder: ethlete-sdk-22 in tmux `claude@ethlete-sdk`; this session runs in
`claude-2@ethlete-sdk`.

## State

- Nothing pushed tonight. origin/next is f6a97186f, CI red on B466 (cli part spec timeouts). The B466-only fix waits in
  the worktree `/tmp/b466-push` at 11de10881 (origin/next + c11cc03ac); its push:suite was blocked by B471, a paint
  window e2e case. The push needs the human (question 1 below).
- Findings tonight: 654-685 in `plans/ethlete-studio/design-to-code.md`. Findings up to 310 are archived in
  `archive/findings-2026-11.md`; the file budget is 440k chars, STATUS.md 230k: archive the next range (311 on) when a
  commit hits the budget, and update the "Archived: Findings 263-310" line.
- STATUS rows tonight: B464 done, B466 open, B467 done (Spotlight off), B468 fixed locally (220e4d6b5), B469 day-shift
  CEF spike (ADR 0242), B470 open (first-load aborts, detail now printed), B471 open (blocks B466 push), B472 open
  (683, no proven cause; the warm-up 995491fb1 was reverted in c009a879e).
- e2e wall time (full `yarn studio:e2e`, Mac, 3 workers): 503.6 s -> 442.2 s (idle worker restart fix) -> 410.9 s
  (667 c shared shot store, 82369780d). One run each, no spread yet.
- Builder queue now: lint slice (685: `yarn commit` eslint on staged files, `nx lint` for affected projects in
  push:suite, plus 663 stale `dist/libs/cli` with a bite), then 667 (a) shared in-flight draw, 667 (b) prune old
  `shots-*` (5.5 GB, never by hand), then 678, the rest of the bug queue (656, 658, 660, 662, 668-dropped, 672, 670 +
  682), then the iframe perf measurement on a quiet machine (figures go to the human in the morning).
- Rules applied tonight (no ADR): a finding writes "Suspect:" until a bite proves it (684, now in both skills); no
  unproven fix that costs wall time (ADR 0230, 0240); no fourth push:suite fix round (ADR 0239).

## Questions for the human in the morning (one round, round format, German)

1. Push the B466 worker-cap fix alone to origin/next with `PUSH_SUITE_SKIP=1`? Worktree `/tmp/b466-push`, 11de10881:
   two vitest worker caps and a changeset. Its cli and Studio unit gates are green; the e2e step failed on a paint
   window case under load that the change cannot touch (B471, finding 681). Four push:suites tonight were red, each on
   a different load-sensitive e2e case. Recommendation: yes, for this one push, so CI proves or disproves the B466 fix;
   the full local range waits for green e2e.
2. The iframe perf figures (if the builder has them): "only visible frames are live" as a day-shift feature?
   Recommendation depends on the figures.
