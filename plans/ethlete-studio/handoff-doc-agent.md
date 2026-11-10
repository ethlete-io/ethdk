# Doc agent handoff (2026-11-10, evening, fifth part, from ethlete-sdk-a6 / tmux claude-2)

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

## Since the last restart (2026-11-10 afternoon)

- ADR 0254 (no harness = never build-ready; studio-lab stays blocked). Findings 717-721 recorded; 8 old findings archived.
- B249: S4a (go/accept removed, apiLevel 8) and 720 fix 15746455b done; Linux builder next: push, real-config "Sketch
  öffnen" re-check, step 4 data migration. Step 3 (go.json rule in git-safety.py) and finding 721 (merge exception in
  git-safety.py, decided A by the human) are blocked: auto mode denies the builder a self-modification. The human must
  approve it in the builder session (tmux claude-3); the doc agent never makes it.
- Mac builder: 708 committed 4ae5bc51c (report not yet in), now 709 app-icon sketch, then B482. Mac mailbox wait must be
  restarted after a restart (command above).
- Step 4 part 1 8dd5634d0 (accepted.json removed); studio/go.json waits for step 3. pictures.json legacy keys: left
  (doc agent), with a spec that a writePictures round trip rewrites go/review to record.
- New idea of the human: `plans/windows-test-pc.md` (the `rack` PC, for later).

## Open questions for the human

None open. The human is back (2026-11-10 evening), but away from the Mac. Steps 3 and 721 (git-safety.py) run: the human left auto mode in tmux claude-3 and approved.

The human answered "ja" (2026-11-10): the builder restarts the "Sketch öffnen" re-check.

- Step 3 + 721 built in 77e87c6b2 (merge path allowed only with MERGE_HEAD and merge-only staged paths; go.json rule
  gone); studio/go.json removed in b52ff697c. Not pushed yet. Left in B249: re-check "Sketch öffnen", step 6, ADR built:.
- Mac: 708 built (4ae5bc51c, c16d3856d); finding 722 recorded; lint scope decided (calls + pre-commit). 709 app-icon
  sketch (studio foundations/logo@app-icon, variants a-d) is ready: tell the human on return, they pick by merge.
- Collected for the human: (1) B482 release smoke bite needs an unlocked Mac screen (CEF page runs no CDP command while
  locked). (2) console log file: decided a, ADR 0255. (3) 709 app icon pick by merge.
- Linux builder restarted from `.claude/handoffs/builder-2026-11-10e.md` (tmux claude-3): merge origin/next by hand
  (ready.json first, commit-hunks.spec.ts by hand), push:suite on the merge head, push the batch with the doc commits
  (ADR 0255 fb1fe0b99 waits for it); then "Sketch öffnen" re-check, step 6, ADR built:, 723, 724. Mac: B482 console
  hook (ADR 0255), then 726; findings 722 (built 8145d8357) and 727 (10b906189) pushed.

## Evening state (2026-11-10, after b6976eb26)

- The human is back but away from the Mac. No open question for the human. Info given: 709 app icon pick by merge,
  the Mac screen stays unlocked: screensaver off (`defaults -currentHost write com.apple.screensaver idleTime -int 0`) and `caffeinate -d -u` runs (pid 90006, 2026-11-10); undo with `pkill -x caffeinate` and `defaults -currentHost delete com.apple.screensaver idleTime`.
- Linux batch pushed 8e25eecda (ADR 0255, 724 fix). Linux builder (ethlete-sdk-3e, tmux claude-3, fresh after
  builder-2026-11-10e): commit the 728 pre-commit Markdown prettier hook with a Built line under 728, watch CI, then the
  real-config "Sketch öffnen" re-check, step 6 gutter skip, ADR built: lines (0048, 0252, 0253), 723, 729.
- Mac: B482 console hook built and pushed (e57c40dd4, e35fcaeb5; ETHLETE_STUDIO_SMOKE_VIEW kept, decided under ADR 0255);
  726 pushed (2f658146e). Now: A1 rest, 12 title-bar hover states (notice-hint is built, 332e49626). Pushes are free
  again; merge origin/next first.
- Findings 722-729 recorded; 722, 724, 726, 727 built. Doc agent rule (728): format every plan file before its commit.

## Late evening state (2026-11-10, after 743eb7901)

- The human is back at the desk. They merged 732 b (7fec742b2) and 709 app-icon a (27e00d769). On the other open
  sketches: "die anderen beiden sind deine baustelle". Sent: Linux builder resolves `components-title-bar.edit` (B483)
  and the `pages-system` marker sketch; Mac builder resolves sdk `components-button.off-centre`. No open question.
- Findings 730-745 recorded. ADR 0256 (stale direct-edit sketch is removed by the tool, STATUS B483) decided.
- Linux builder (ethlete-sdk-3e): 742 fixed in 6ada387e2 (push suite, then push), then serve with `DE_PORT=4402` in tmux
  `studio-serve`, then B483 (ADR 0256), then 731 (e2e under quota), 745, 736+737. 735, 719 quota step, 732 sketch done.
- Mac builder: B482 bite running on the unlocked screen; B345 sketch `pages/sketches@change-crop` (a5bf3bff2, eb0eb9eb8)
  waits for push (person-name fix in sketch data, finding 743), then the human picks it. Then backlog 628-633, the darwin
  quota gap (735).
- Mac mailbox wait: restart it at once (command at the top). Background task may still run from the old session.
