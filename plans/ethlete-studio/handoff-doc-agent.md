# Doc agent handoff (2026-11-10, day shift, third part, from ethlete-sdk-a6 / tmux claude-2)

Run `/doc-agent` first. The human is **afk** (said "afk"): collect design questions, one chat line per event, no round
until they say they are back.

## Sessions

- Linux builder: ethlete-sdk-3e in tmux `claude-3@ethlete-sdk`, role builder.
- Mac builder: tmux `claude@ethlete-sdk` on ethlete-mac (told to restart itself with `--role builder`; check with a
  pane capture). Send work with a file: `scp -q /tmp/x.txt ethlete-mac:/tmp/x.txt && ssh ethlete-mac 'zsh -lc "cd
~/dev/ethlete-sdk && node .agents/skills/ethlete-agent-sessions/agent-sessions.mjs send doc-agent --to claude <
/tmp/x.txt"'`. Never put the message inline in the ssh string: backticks ran `git pull` and `git push` on the Mac once.
- Start the Mac mailbox wait in the background at once:
  `ssh ethlete-mac 'zsh -lc "cd ~/dev/ethlete-sdk && node .agents/skills/ethlete-agent-sessions/agent-sessions.mjs inbox doc-agent --wait 3500"'`

## State

- Findings 706-716 in `design-to-code.md`; as-built notes for 706, 706a, 707, 710, 714, 715. ADRs 0252 (Studio does not
  jump into an @edit sketch) and 0253 (no old design → sketch with only `new`), both `open: B249`.
- Binding order (ADR 0234, STATUS "Gerade in Arbeit"): B249 is item 1. Finding 711: the doc agent had queued only
  findings; never queue tool work ahead of the STATUS order unless CI is red or it blocks the item.
- Linux builder queue: CI run 42826707435 (query-clock-edges, real run 1 of 2 owed), then B249: missing harness =
  "Nicht baubereit" (in an opus subagent), browser check of "Sketch öffnen", CLI removal (apiLevel 8), go.json hook
  rule, data migration, docs and skills, gutter skip in `pages/sketches`. Pushed B249 slices: 498d82393, c58f340a0,
  5d7bcee34, 1bacbcefa, a3890721a.
- Mac builder queue: 713 (pre-commit label-spec lint), 712 (check-system-sketch port 0), `realOf()` nearest existing
  ancestor in `libs/cli` `package-root.ts`. Then tool backlog: 708, 709 (sketch first), B482.
- Decided by the doc agent (technical): 714 assert `>= 18000` is the exact bound; the edge fractions run as parallel
  CI jobs (ADR 0240). B249 Q1 (status words, ADR 0041) and Q3 (ADR 0209 stands, agent picks `new` with ADR note).
- Open: pages/start EDIT-OLD-NOT-FOUND — the builder says whether an ADR covers it (then agent pick) or it waits for
  the human. 714 tool fix and 710 sweep need a slow factor measured from CI, not 13.

## Side work

- Issue ethlete-io/ethdk#3172 (tooltip on touch): built in 181eb140d by session ethlete-sdk-3b (500 ms long press,
  hides 1.5 s after lift; toggletip icon-button example). The Linux builder pushes it. Tell the human on return: the
  issue comment and close are theirs.

## Since the last restart (2026-11-10 afternoon)

- ADR 0254 (no harness = never build-ready; studio-lab stays blocked). Findings 717-721 recorded; 8 old findings archived.
- B249: S4a (go/accept removed, apiLevel 8) and 720 fix 15746455b done; Linux builder next: push, real-config "Sketch
  öffnen" re-check, step 4 data migration. Step 3 (go.json rule in git-safety.py) and finding 721 (merge exception in
  git-safety.py, decided A by the human) are blocked: auto mode denies the builder a self-modification. The human must
  approve it in the builder session (tmux claude-3); the doc agent never makes it.
- Mac builder: 708 committed 4ae5bc51c (report not yet in), now 709 app-icon sketch, then B482. Mac mailbox wait must be
  restarted after a restart (command above).
- Issue #3172 tooltip touch: built 181eb140d, pushed; the human comments/closes the issue.
- Step 4 part 1 8dd5634d0 (accepted.json removed); studio/go.json waits for step 3. pictures.json legacy keys: left
  (doc agent), with a spec that a writePictures round trip rewrites go/review to record.
- New idea of the human: `plans/windows-test-pc.md` (the `rack` PC, for later).

## Open questions for the human

None open. The human is afk until late evening (2026-11-10): collect questions, no round until they are back. Steps 3 and 721 (git-safety.py) wait for their approval in tmux claude-3.

## Collected for the human's return

- 721 and step 3 (git-safety.py): the human approved "merge ausnahme erteilt" in tmux claude-3, but auto mode still
  denies the edit as self-modification. The human picks: (a) a permission rule for the edit, or that session out of
  auto mode for the slice (recommended: the builder brief is ready); (b) run the slice in a session without the hook.
- The human stopped the real-config "Sketch öffnen" re-check agent. Ask: on purpose, or restart it? (Recommended:
  restart; it is the open browser check of B249.)
