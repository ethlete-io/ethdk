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

## Questions for the human in the morning (one round, round format)

1. On which machine does the 90 s e2e goal of ADR 0237 count? The Mac runs the step in about 420-520 s on 3
   workers, the PC in 117-127 s on 8 (finding 664). Recommendation: the PC, and the Mac only reports its time.
2. Exclude the checkout from Spotlight indexing on the Mac? `mds_stores` and `mediaanalysisd` ran at about 140 % CPU
   during the e2e measurement (finding 666). Recommendation: yes, the human adds it in System Settings.
3. Three orphan `a-cli` design servers (pids 65717-65719, parent 1, 1.5 days old) are still alive; the permission
   check refused the builder's kill, so the human must stop them (finding 673). Not a decision, an action.
