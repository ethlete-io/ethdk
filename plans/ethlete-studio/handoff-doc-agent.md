# Doc agent handoff for the day shift (2026-11-10, from ethlete-sdk-68 / tmux claude-2)

Run `/doc-agent` first. The human is awake: grill rounds are allowed again. Builder: ethlete-sdk-22 in tmux
`claude@ethlete-sdk`, on its day-shift handoff `plans/ethlete-studio/handoff-builder-mac.md`.

## State

- Morning round done: ADR 0243 (push the night range with `PUSH_SUITE_SKIP=1`, row B474), 0244 (visible-only frames
  dropped, built), 0245 (push:suite lints and typechecks the touched projects, built 9a2573e21), 0246 (`typescript-lsp`
  plugin for agent sessions, row B475).
- origin/next is still f6a97186f, CI red on B466 (cli spec timeouts). The fix c11cc03ac is in the unpushed range. The
  builder does not set `PUSH_SUITE_SKIP` itself (its skill: for the human only). The human must run
  `! PUSH_SUITE_SKIP=1 git push origin next` in the builder session. Then tell the builder, which watches CI, and close
  B474 with the push sha (`built:` on ADR 0243).
- B475: the human installs the plugin (`/plugin install typescript-lsp@claude-plugins-official`, scope project). Then
  the builder bites it with a deliberate type error and closes B475 (`built:` on ADR 0246).
- Findings this shift: 686-690 in `plans/ethlete-studio/design-to-code.md`. Archived up to 339. The file budget is 440k
  chars. Archive the next range (340 on) when a commit hits it.
- Builder queue: 690 skill line (`git -C <worktree>` for bite commits), the OFF-CENTRE base comparison on
  `elements/canvas-frames` (3 findings at 7d72894fa, button text 1 px high), then 689 (lib `typecheck` targets also check
  `tsconfig.lib.json`; time per lib first, figures to the doc agent), then B476 (ESLint hook, ADR 0247), then B469 CEF spike (ADR 0242), then quiet-machine
  perf and a full studio:e2e.
- B472 (683) stays open with no proven cause (18/18 under load). B471 fix is 7d72894fa (high fetch priority after a
  camera switch). Its 3 OFF-CENTRE findings are not compared to the base yet.

## Open questions for the human

- Tell the human: for B476 the builder builds and measures the hook script and sends the exact JSON block for
  `.claude/settings.json`. It does not edit that file on a peer message. The human adds the block or tells the builder
  in its own session to add it. 690 skill line is done (97ac9b574).

None. Q5 answered "5ok": ADR 0247, row B476 (ESLint hook after each agent edit).

## Rules applied (no ADR)

- A finding writes "Suspect:" until a bite proves it.
- Before a decision on push or gate files, run `yarn adr:governs`. ADR 0038 now governs `push-suite.mjs` (finding 688).
- Commit bodies: lines of 100 chars at most (commitlint). Re-read the plan before you add a finding: the builder also
  writes findings (a duplicate 689 happened).
