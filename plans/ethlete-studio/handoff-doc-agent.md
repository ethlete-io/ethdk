# Doc agent handoff for the Mac night shift (2026-11-09, second part, from ethlete-sdk-68)

Run `/doc-agent` first, then read ADR 0239. Scope of the night: e2e speed, then perf, then bugs; no features, not
B249. The human is away ("afk"): collect questions for the morning, no grill round; one short German line per event.
Builder: ethlete-sdk-22 in tmux `claude@ethlete-sdk`; this session runs in `claude-2@ethlete-sdk`.

## State

- Red CI: the cargo audit fix (RUSTSEC-2026-0459, rusqlite 0.41.1) is pushed in f6a97186f; cargo audit is green.
  CI is still red on B466 (cli `part-go`/`part-ready` 30 s timeouts, suspect the fixed `maxWorkers: 4` of 343e968aa;
  c11cc03ac makes it `min(4, cores - 1)`). The builder now runs push:suite for 37 unpushed commits (incl. 9e4ada3c5
  B465 fix, c11cc03ac), then pushes and reports the CI run id. Next for you: close B466 in STATUS when that CI run
  is green (set the result column; no ADR has `open: B466`), or record the new cause.
- Findings tonight: 654-676 in `plans/ethlete-studio/design-to-code.md`. STATUS rows tonight: B462 (Sketches first
  load flake, cause in 667), B463 done, B464 (hover flake, fix queued), B465 done locally, B466 open.
- Bug queue I set for the builder, in order: 656 push-suite re-exec from the export, 658 vitest FAIL rows in
  failureReport, 660 git regex lint, 662 shared vitest preset `min(cap, default)`, 663 stale dist check before
  workers, 668 hover case waits for a stable DOM, 672 runner flags a wait window shorter than the hold, 667 (c)
  shared shot/vite cache keyed by the read-files fingerprint (this is the ADR 0239 disk check cache), 673 design
  server exits with its parent, 670 slice-paths warning names its source; then 650/659/664 load report. Queue 1 rest:
  3 idle runs with machine, cores, workers and load printed.
- Decided by me tonight (applied rules, no ADR): no PUSH_SUITE_SKIP for agents (builder-agent skill); the cargo fix
  went through push-suite on origin/next plus only the needed commits; the worker count stays 3 on the Mac (666).

## Questions for the human in the morning

Answered on 2026-11-09 in the morning round: ADR 0240 (the 90 s goal counts on the desk PC, every machine stays as
fast as possible) and ADR 0241 (the human excludes the checkout from Spotlight). The doc agent stopped the three
orphan design servers with the human's consent.

## Part 3 (2026-11-10, ethlete-sdk-68)

- The human answered the morning round and went to bed after ADR 0242; collect new questions for the morning again.
- New tonight: findings 677-679, STATUS rows B467 (closed), B468 (fix 220e4d6b5 local), B469 (day shift, CEF spike),
  ADRs 0240-0242. B464 closed by the builder.
- Waiting: the third push:suite. If red on a new case, the builder pushes only the B466 worker-cap fix through
  push-suite on origin/next and tells me first; if B468 is red again, its failure detail must name the cause. Close
  B466 when the CI run after the push is green.
- Queued for the builder after the bug queue: iframe perf measurement (live iframes, memory and CPU per iframe, time to
  all painted, visible-only variant), figures go to the human in the morning.

### Question for the human in the morning (round format)

1. Push the B466 worker-cap fix alone to origin/next with `PUSH_SUITE_SKIP=1`? The worktree `/tmp/b466-push` holds
   11de10881 (origin/next + c11cc03ac: two vitest worker caps and a changeset). Its cli and Studio unit gates are green;
   the e2e step failed on a paint-window case under load that the change cannot touch (B471, finding 681). Four
   push:suites tonight were red, each on a different load-sensitive e2e case. Recommendation: yes, the human allows the
   skip for this one push, so CI proves or disproves the B466 fix; the full local range waits for green e2e.
