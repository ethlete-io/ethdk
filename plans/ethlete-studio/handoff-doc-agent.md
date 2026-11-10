# Doc agent handoff (2026-11-10, day shift, from ethlete-sdk-68 / tmux claude-2)

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
- Day shift start: the human was reminded in German of the B474 push and the B475 plugin install. Neither was done at
  the handoff (origin/next still f6a97186f, 122 commits unpushed). The builder sends the push sha when it lands.
- Findings: up to 691 in `plans/ethlete-studio/design-to-code.md`. Archived up to 414 (file now about 388k chars, budget
  440k). Finding 691: the 3 OFF-CENTRE lines are older than 7d72894fa (B471 fix is clear); new row B477 for the 1 px
  high button text. 691 has no tool lesson yet: ask the builder which gate runs the OFF-CENTRE check today.
- Builder queue: 689 (lib `typecheck` targets also check
  `tsconfig.lib.json`; time per lib first, figures to the doc agent), then B476 (ESLint hook, ADR 0247), then B469 CEF spike (ADR 0242), then quiet-machine
  perf and a full studio:e2e.
- B472 (683) stays open with no proven cause (18/18 under load). B471 fix is 7d72894fa (high fetch priority after a
  camera switch). Its 3 OFF-CENTRE findings are older (691, B477).

## Open questions for the human

None. The human knows the B476 settings step: the builder sends the JSON block for `.claude/settings.json`, and the
human adds it or tells the builder in its own session to add it.

## Rules applied (no ADR)

- A finding writes "Suspect:" until a bite proves it.
- Before a decision on push or gate files, run `yarn adr:governs`. ADR 0038 now governs `push-suite.mjs` (finding 688).
- Commit bodies: lines of 100 chars at most (commitlint). Re-read the plan before you add a finding: the builder also
  writes findings (a duplicate 689 happened).
