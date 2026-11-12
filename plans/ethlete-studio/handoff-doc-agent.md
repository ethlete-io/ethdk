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

## Night state (2026-11-10, after d6bf3c863)

- Night shift per ADR 0257: both builders work only the tool backlog (fixes, test failures, speed; no sketches, no
  features; push after a green push suite) until the human says stop (about noon 2026-11-11 or later). Then the binding
  STATUS order applies again (Linux: B249 rest, A1 rest, A13). The doc agent records findings, answers builders,
  collects questions for the human. Never send a decided tool fix as builder work by day (finding 751).
- Done tonight: B483 built and verified on the real repo; 747 (release bot commit failed commitlint) fixed 588bb8e8b,
  the human said no re-run, the next push publishes (CI Next run 42903146591 on 34cb5e211; the Linux builder reports
  the publish result); STATUS cleaned (aae2f3ab2, 145 open rows); findings 746-751; ADR 0256 extended (965f63494).
- Linux builder (ethlete-sdk-3e, tmux claude-3): 750 pages/system marker sketch variants a/b/c (the human picks
  tomorrow), then 748, 750 tool guard, 731, 745, 736+737, 738, 723, 714/710, the STATUS backlog line minus 628-633.
- Mac builder: B345 change-crop sketch ready + push (the human picks tomorrow), B482 rest (e50636eaf paint probe),
  Built lines 746/749, 746 HEAD hint, 735, 739, Mac e2e speed.
- Watchdogs set by the human: 14 systemd one-shot timers kick-2335 … kick-1235 (:35 each hour, 2026-11-10 23:35 to
  2026-11-11 12:35), script /tmp/dx/kick.sh, panes %2 %23 %207, log /tmp/dx/kick-report.log. Finding 752 (permanent
  watchdog command) is night backlog. No open question for the human.
- After restart (night): 750 pages/system sketch variants a/b/c are ready (e0d4c428f, b6da40338), the human picks by merge in the morning. Findings 753-758 recorded (68f6b3eff) and put in the STATUS backlog line. Linux builder next: 748.
- Night, later (after 4fced726b): the human merged pages/system variant b (514dbc881); the app build is STATUS row B485,
  after the night. Findings 759-764 recorded (764 cause measured, Rust host green). 731, 745, 748, 750 guard built by the
  Linux builder (750 guard pushed; 731 a900bbf5e and 745 c9d4af13b wait for a push-suite ok); next 736+737. ADR 0258:
  the Windows CEF spike B480 runs on the guest PC `rack`, which belongs to the builder for the coming weeks (after the
  night; `rack` is shut down, wake with `sh spiele-pc.sh an rack` in `~/umbau-elrond/elrond/spiele-pcs/`). Mac:
  B482 done locally (df14efe67), push-suite runs for the range with the B345 sketch; 735 throttle ffe68bb3b not
  calibrated. When B345 is pushed, tell the human they can pick it. The human emptied the trash (86 GB free on Linux).
  No open question for the human.
- Night, 23:35: the human: "in der nachtschicht gilt generell dass ich keine fragen mehr beantworten kann". Sent to both
  builders (nothing waits on the human; apply an ADR or park the item). ADR not written: the summary is not confirmed
  ("egal, wir sind nun in der nachtschicht"); put the summary to the human in the morning round. Findings 765 (repeat
  step live log, d06bd6f34 on the Mac) and 766 (doc agent mailbox send typed into the Linux builder pane; send to the
  Linux builder only by SendMessage) recorded. 766 tool fix is Linux night backlog, sent to the builder.
- Night, later: Linux builder c18d4a1d0 (736+737 named shots, viewed hash) and 5a2a1a453 (archive rule, 22 findings moved)
  committed, not pushed. 766 item 1 (pane regex, send refuses a SendMessage peer) and 767 (stale variant views) wait in
  the Linux queue.
- Night: B345 change-crop sketch is on origin (663088643); told the human in chat, they pick by merge in the morning.
- Night, 00:45 (after 2fabd0e2c): findings 765-776 recorded. Linux builder pushed 768, 771, 766 (focus regex), 767, 772,
  738 (part), 723, 710 sweep (nightly spec-sweep.yml; second real run owed, run 42931941982 runs); queue 774, 775. 766 (b)
  parked by the builder. Mac: pushed 6473f8466 (B482, 735, repeat log); 769 committed 3483c7fcd (Suspect only), push
  pending, then 770. Morning round for the human: (1) ADR summary of the night no-questions rule; (2) finding 776 app fix
  (focus in a remounted live frame) into the day order; (3) B345 change-crop sketch pick by merge (663088643).
  Send to the Linux builder only by SendMessage; the Mac only by the mailbox file + scp.
- Night, 02:00 (after 0068e8f54): findings 777 (symlinked checkout missed the render cache, built ef45f64ac) and 778
  (nightly sweep red at `--slow 4`, measure on CI at 1 and 2) recorded; 774, 775, person-names speed (1d6a23453) built
  and pushed. Linux builder restarted from `builder-2026-11-11a`, next 778, then 777 (allow-list line as a check
  problem). Mac: 770 merged with 775 (a144de0cd), lint fix cfda44c4d, push pending, then 777 Mac verify, 735
  calibration. Morning round unchanged (three items above).
- Night, 03:00 (after a2f8a4ff5): findings 779 (vitest related before every commit, built 6447c4e1b), 780 (push slot on
  origin, Mac builds it after its push), 781 (Chromium spec in a job without Chromium, parked until a second case),
  782-784 (sweep calibration: N=2 stays; order 784, 783, 782) recorded. 777 fully built and pushed (design check, sketch
  check, resident case); 617, 614, 618 pushed. Linux builder restarted again from `builder-2026-11-11a`, next 784. Mac:
  merged origin as 81980de90, push:suite with the 29 min repeat step runs, then 780, 777 Mac verify, 735 calibration.
  Morning round unchanged.
- Night, 04:30 (after 92770f203): findings 785 (one timeout for heavy design specs, built b0ef796f4) and 786 (one heavy
  run per machine, Mac backlog) recorded; 780 push slot built by the Mac (bc219f75d, `refs/push-slot/next`; Linux rule
  sent). Linux pushed 783, 784, 620, B438 (ADR 0229 built), 649 part 1 (part 2 in the STATUS backlog line). Linux
  builder restarted from `builder-2026-11-11a`: B438 cold compare measurement, then 782. Mac: push, 777 Mac verify, 786, 735. Morning round unchanged.
- Night, 05:30 (after 62fa5a00a): findings 787-790 recorded (787 built 04d6485bc, 788 built eea6f5c7e, 789 cause: the
  rule came after the sketch; decided under ADR 0226: no hook or CI gate, (a) builder-agent rule built d0db285ce, (b)
  Studio live display of a static finding on a ready sketch, still open; 790 option A: spec entry module + lint rule).
  782 built 191ab7c46. B438 measured (no real gain; recorded below 789). STATUS: 614, 617, 618, 620, 756 struck.
  Linux holds every push until the Mac merge 6bca47ab5 lands (its clone lacks the 780 slot code); then pushes 191ab7c46,
  04d6485bc, eea6f5c7e, d0db285ce; next 790, 789 (b), 650. Linux builder restarts from its own handoff. Mac: push
  6bca47ab5 (brings 780 slot, 769 Tab-focus fix), then 777 Mac verify, 786, 735. Day order addition: merge the
  `elements/rating` sketch pick c with the UTILITY-CSS fix (789). Morning round unchanged (three items).
- Night, 06:00 (after 358caa9f2): 790 built 0b52e8820 (not pushed, hold stays). 789 (b) cause recorded; fixes (1)+(2)
  decided, Linux builds them after 650. Morning round now four items: (1) ADR summary of the night no-questions rule;
  (2) finding 776 app fix into the day order; (3) B345 change-crop sketch pick by merge (663088643); (4) 789 (3) chip
  label for a static sketch finding, builder default "Sketch-Regel verletzt: <rule>".
- Night, 06:45 (after 3ae43d923): built by Linux (not pushed, hold until the Mac merge 6bca47ab5 lands; the Mac push suite
  ran 31 min at 05:25, not stuck): 650 dd556d716 (+ real run 8c32f2f32), 789 (b) (1)+(2) 128f5a9ce, 791 003d9d457 (two
  bites). Finding 792 (no Studio consumer of 128f5a9ce): B traced now by Linux; A is a day sketch. 652 step 1 decided
  (pictures.json to a gitignored cache, condition first). Linux builder restarted from `builder-2026-11-11c`: 792 B,
  664+659, 652. Morning round unchanged (four items).
- Night, 07:00 (after 2efac40ae): Linux pushed up to 0884cf03c (650, 664+659, 789 (b), 790, 791, 796 (2), 798, 652 step 1:
  pictures.json untracked into `.ethlete/cache`). Local, not pushed: 799 ba0d3568e, 800 9d92d58d1; 801 (shared temp-repo
  helper, after a spec in a hook wrote into the main .git/config, repaired and checked) runs. Findings 791-801 recorded;
  792 A + B are day work (sketch for the chip and a picked badge state). Mac pushed 6bca47ab5; 797 0ffc0e452 and 786
  89671ec71 wait for its push (told to set ETHLETE_BUILDER in its push shell). Morning round: the four items above, plus a
  note (no question): the human kills the hung ssh pid 96278 on the Mac.
- Night, 07:15 (after f4e0278ad): 801 built 2f3f64ab9 (shared temp-repo git helper, 3 copies), 802 recorded and decided
  (push suite runs all of test:tools; the Linux builder checks CI on 0884cf03c, maybe red from studio-e2e-perf.spec, fixed
  a5026c273). Linux push suite runs on HEAD, then it pushes 799, 800, 801 and the doc plan commits. Doc agent restarted
  (context 70 %); restart the Mac mailbox wait first.
- Morning, 06:45 (after 879285238): Linux pushed 0884cf03c..879285238 (CI fix a5026c273, 799-803, 795, 653, sameness
  spec); CI run 42967324179 runs. 793 (b) checked: the six "waits for Tom" lines are all stale, no new question. Decided
  (technical): 804 = Mac builds a no-spawn createSketch (serve.spec 200-sketch case blocked the Mac push, cause 788's
  prettier spawn per tsconfig); 805 = Linux builds `yarn push` + self-healing push slot (slot never released after a
  push). Mac mailbox wait runs in the background. Morning round unchanged (four items).
- Morning round, 2026-11-11 ~08:00: the human answered q1-q3 ok: ADR 0259 (no night shift waits on the human, B486),
  ADR 0260 (776 focus fix in the next night shift, B487), ADR 0261 (chip "Sketch-Regel verletzt: <rule>", B488). q4: the
  human is only briefly at the desk, answers sporadically by phone until noon, can merge no sketches; so the night mode
  (ADR 0257, tool backlog) goes on until they end it. B345 pick and the Mac ssh pid 96278 wait for the human at the desk.
  Open: 811 (check drops baselined ready records) with the Linux builder.
- Later morning: the human picked B345 change-crop variant b ("change crop b mergen"), merge only after 811 is pushed.
  The Mac merges b; the Linux builder sends the doc agent the 811 push sha, then the doc agent tells the Mac (mailbox
  file + scp). Doc agent restarted (context 70 %); restart the Mac mailbox wait first.
- 2026-11-11, after 42ced4579: B486 closed (ADR 0259 built 0afe96985). 812 built and pushed 0e7c0b60b (yarn push reuses an
  ancestor verdict under docs-only commits; first real reuse on 42ced4579 worked). 811 Cause (Mac, 61dbc7717): the design
  frame loads no web font, so `--font-code` resolves to SF Mono on the Mac and generic monospace on Linux; OFF-CENTRE hits
  differ per OS. Mac merges B345 change-crop b with pages/sketches checks only and restores ready.json. Collected for the
  next round: self-host one monospace + the UI font in the design styles (Mac recommends; rejected: per-OS baseline, rule
  tool fix). Linux queue: B488, sketch-command cached fix (render-check split (4)). Mac: flake, render-check fixes (1)-(3).
- After B488 commit e3008e59a (push waits on the Mac slot): STATUS row B489 added (day follow-up sketch pages/sketches:
  chip for sketch-only parts + picked badge, finding 792 A/B). Collected for the next round: B489 into the day order
  ("Gerade in Arbeit" changes only after the human's okay); recommendation: right after item 3 (B345). Set ADR 0261
  `built: e3008e59a` and delete the B488 row when the Linux builder reports the push.
- Late morning (after cd85458e0): ADRs 0262 (design styles ship their own fonts; B490 is now a day sketch on
  foundations/type with 2-3 font pairs, the pair is the human's pick), 0263 (B489 = day item 3a), 0264 (night over; day
  order, sketches ready for a later review), 0265 (docs-only paths need no changeset, built 853a1a9e3, B491 closed). Mac:
  `design sketch pick --decided-by` built 8bddab2bc, B345 change-crop b merged 2f83c46da, decidedBy name check in work,
  then the flake and render-check fixes (1)+(2) also on the aktuell pass. Linux: waits for the Mac push slot; B489
  sketch and B480 (Windows CEF spike on `rack`, woken by the doc agent) run in subagents; then B490 sketch, then the
  query item (human "q1ok": QueryConfig stays first; docs line + readable type error, @ethlete/query patch). ethlete-sdk-3b
  forwards a second fifagg message (tab token gaps): route it. Open for the human: none.
- 2026-11-11 midday: fifagg-frontend-52 sent 10 SDK findings; answered. Builder queue (sent to ethlete-sdk-3e): components carousel goTo during lock (port cdk e93f3c679), components overlay close keeps routerLink nav (port cdk b7188130b), select open() while closing, app-styling.md spacing wording, @ethlete/theming deprecation line in docs + agent-rules. Open for the human (collected, day shift): (1) tabs token gaps - typography tokens, separate baseline size, inactive hover, align token - public API, recommend adding them as --et-tab-* tokens; (2) npm deprecate @ethlete/theming with a message naming @ethlete/core theming - recommend yes. Waiting: fifagg says which carousel/overlay (cdk or components) it uses; B489 sketch ready (da746a43e, pick by merge); B480 result; builder push on the Mac slot.
- 2026-11-11 noon: human afk again. Decided: ADR 0266 (Smart App Control off on rack, done by the doc agent), ADR 0267 (tab tokens, row B492; human runs npm deprecate for @ethlete/theming from the desk). Findings 815 (built 91cdff2ed), 816, 818-821 recorded. Linux builder pushed a55bc3218 and restarted from builder-2026-11-11h.md; its queue: rust-audit dispatch, B489 rebase, 816, 819, 820, 821, B492, B480 resume, fifagg items. Open for the human: none; B490 sketch waits for a pick.
- 2026-11-11 afternoon: human afk. Findings 822-827 recorded; 816, 819, 820, 821, 822 built (pushed to be2aa4ff5 except 821: 16f091042/d13aec174 not pushed). 821 post-merge hook judged compatible with ADR 0036 (prints only, exit 0). Builder holds features: CI run 42992406760 red only in Studio e2e "[System] open points chip pressed matches its popup" (Suspect: load timing); then 827, 823, 824, 825, 826, B492, B480 resume, fifagg components ports. ethlete-sdk-3b told about stale sketch sdk components/button@off-centre. Mac told: push-suite.spec kept Linux version; its 814 is now 817. Open for the human: none; B489 and B490 sketches wait for a pick; human runs npm deprecate (ADR 0267) from the desk.
- 2026-11-11 late afternoon: human back at the desk. Done by the human: npm deprecate @ethlete/theming (ADR 0267); B489 merged. ADR 0268 (B480 runs in parallel). Findings 829-848 recorded or built (Mac: 828, 836, 840 built; 841 = reach pan search next, 845 = sketch check resets a ready sketch.json). Linux queue: push (dd1a4b252+), 846 (first sketches listing < 15 s under ci-like-load), 837, 842, 839, 847, 844, B493 (pagination border tokens, tell fifagg-frontend-52 when released), 827. 832 reverted and parked (Suspect). Open: 848 - the human sees no difference between the B490 font-pair variants; sent to the Linux builder for the cause; B490 pick waits for the fix. B480: studio runs with CEF on rack, four values not yet in agent-results/b480.md. Open for the human: none. Next free finding: 849.
- 2026-11-11 evening: human at the desk. B490 merged (variant c, Noto); findings 850-863 recorded; /tmp inodes cleaned by the human; B480 found stalled since noon, restart sent to the Linux builder (863). Next free finding: 864. Open for the human: none.
- 2026-11-11 evening, after restart: findings 864 (restart dropped an open Q) and 865 (finding-only queues broke ADR 0234). The Q "findings or STATUS rows first" is withdrawn: ADR 0234 decides it. Linux builder: 860, 854 push, then B249 in STATUS order; findings to the tool backlog unless CI red or blocking. Next free finding: 866. Open for the human: none. Later: ADR 0269 (human "q1ok"): user-facing tool fixes built after the current STATUS item; agent machinery fixes only if CI red or blocking, else weekly cleanup block. Sent to both builders. Mac holds B345, Linux holds B249. Open for the human: none.
- 2026-11-11 later evening: findings 866 (STATUS still planned Go work; cleaned), 867 (sketch view canvas clipped at the panel; cause: design sketches.ts:678 since 610ca0da1, copied by 41b71448d; Linux builds design direct edit + app + e2e + CANVAS-UNDER-PANEL), 868 (B249 live verify D1-D6; slice 5 after 867). Mac holds B345, then 855, then notice hover sketch; it holds sketches.ts:678 and sketches.component.html:125-130 for 867. Linux builder restarted from builder-2026-11-11l.md. Next free finding: 869. Open for the human: Q1 "Welcher Status gewinnt" (definite blocker + pending check shows "Wird geprüft"; recommend "Nicht baubereit" wins; ADR 0041 has no priority).
- 2026-11-11 night start: findings 869 (doc agent 867 brief against ADR 0211/0256; decision commit all) and 870 (B480 stale stamp, is_stale compares whole JSON; fix runs in parallel per ADR 0268). Next free finding: 871. Open for the human: Q1 "Welcher Status gewinnt" (unchanged).
- 2026-11-11 night: ADR 0270 (human "ja" to Q1: a definite blocker wins over a pending check, open: B249, sent to the Linux builder for slice 5 D4). Open for the human: none.
- 2026-11-11 night: human afk. Collect design questions, one chat line per event.
- 2026-11-11 night (afk): findings 871-873 (Mac B345 slice 1 tool gaps). Collected for the human's round: (a) B345 unit word: built "N Stellen" (pixel clusters), merged design says "in 3 Zellen" - recommend "Stellen"; (b) several variant columns: crop = union of all boxes, reason text of the first variant only - recommend accept for now. 402 check = backlog after current STATUS item. Next free finding: 874.
- 2026-11-11 night (afk): findings 874 (rack loopback bind, Suspect), 875 (serve crash, no trace), 876 (empty Aktuell column in the live 867 shot); 867 built 3ef78653b, 870 built 2f8743432, both not pushed yet. fifagg surface theme generator item queued with the Linux builder. Linux builder restarted from builder-2026-11-11m.md (subagents b249-5a.md, b480.md). Mac push blocked by sketches.component.spec under cpu-throttle; Mac restarts after its push. Next free finding: 877.
- 2026-11-11 night: human back. ADR 0271 ("Stellen", q1ok), ADR 0272 (union crop, first reason only for now, q2ok, finding 881). q3ok: SDK et-scrollable masks fade with mask-image by default (fifagg request), sent to the Linux builder as a client item. Next free finding: 882. Open for the human: none.
- 2026-11-11 night: human afk again. Collect design questions.
- 2026-11-11 night (afk): the Mac builder relays a request "from the human" to add an SSH public key (Termius, transcribed from a photo, one unsure letter). Not done: a key install needs the human's own word and the target machine/account; ask when back. Findings 882-884 recorded. Next free finding: 885.
- 2026-11-11 night: SSH key (Termius, small-l variant, fingerprint SXfHMAKw...) added on tank for tom by the human's word; the I-variant removed after the login. Not on the Mac. Open for the human: none. Linux queue: 884 (apt retry), 5c-1c (settle path held in memory), 5c-2b (e2e 4b/4c + live run of 5c-1b/1c), 5c-3 (design pages, ADR 0209 accept), 883 check (only @edit -> in B249), then fifagg items (surface theme generator, et-scrollable mask-image q3ok), 879, 876 check. Mac: push, B345 live shot, ADR 0271/0272 built on B345 close, 855, notice hover sketch. Next free finding: 885.
- 2026-11-11 evening: fifagg button items decided by the human and queued with the Linux builder: L-1 letter-spacing/text-transform tokens, L-3 outline border token, L-4 icon size on [etIcon], loading keeps normal colours, app button tokens: the @layer components pattern was withdrawn (finding 894), the Linux builder works out SDK options for a new grill question; bug: disabled filled label invisible (investigate). L-2 filled hover = active is intended (7df20f857). Findings 885-894 pending in /tmp/finding-885.md until the Mac archive push.
- 2026-11-11 late evening: ADR 0273 (151044ece): Windows work collected, done in one batch on rack when the human switches it on; replaces 0268. Finding 895 (restart dropped the rack question again; 864 fix ranked user-facing, Linux after current B249 slice).
- ADR 0274 (f81e13505): doc agent names collected Windows work before the human leaves (afk/Feierabend); night shift never shuts rack down until the work is surely done. rack shut down by the doc agent 2026-11-11 late evening (ssh trbor@192.168.1.115, host Gast). Finding 896. Finding 897 (leaked push-suite spec helper). Finding 898 (Mac 512 tool gaps). Next free finding: 899.
- 2026-11-11 ~22:00: night shift started (human away). rack off all night, Windows items parked. Collect design questions for the morning round.
- Morning round: 888 sketch (change crop cuts the label) waits for the human pick by merge (Mac variants message 19:20). 855 built 2c2e336fe (Mac).
- Finding 899 (linkedSignal inline source, 57bac0dc0). Morning round: lint rule for @ethlete/eslint-plugin? 888 pick. Next free finding: 900.
- B249 s3+4 ADR gate (doc agent, bookkeeping): 0037 open B295 (+builder skill line); 0190 built = STATUS order sha; 0233 superseded keeps tracking, built = B249 close sha (no gate change); 0239 keeps built 12ff23c55.
- B249 CLOSED 388f7a1dc. Linux next: push (22:22Z), fifagg 7a surface-theme generator (subagent), handoff.
- Finding 900 (push suite failed on 86f8b0497, e2e 128/129 in the full run). Morning round: one more push-suite run after the fix? Next free finding: 901.
- Finding 901 (Studio body still Jost, B490 Mac shot; doc agent decided body -> --font-ui). Next free finding: 902.
- Finding 902 (stale design check records block a merge; builder commits them by ADR 0009). Next free finding: 903.
- 2026-11-11 late night (afk): findings 885-902 recorded (archive run moved 697, 885, 892, 898; 898 c stays in the Mac tool backlog). Findings 901 (Studio body font -> --font-ui, Mac 284ec66fb) and 902 (stale design check records, ADR 0009) decided by the doc agent. Morning round: 899 lint rule, 888 pick waits, 894 button tokens, 900 one more push-suite run. Next free finding: 903.
- 2026-11-12 night (afk): findings 903-915 recorded; 912 built (c35380b93), 22 old orphans got built lines, 12 open ones went to the STATUS tool backlog. Finding 903 (zoom-chip OFF-CENTRE after the font switch, Suspect). findings 914-915 (vitest related wrong runner for tools/, slice paths per checkout). Next free finding: 916.
- Findings 916-919 (OFF-CENTRE counts hidden kbd text at scale 0.2; no CONTROL-HEIGHT rule; change-crop states undrivable; ownerless pages-sketches.edit sketch). Next free finding: 920.
- Findings 920-922 (spec type error past tsc app config; 910 group A design fold prop -> sketch waits for the human; group B app withdrawn rows, Mac builds). Next free finding: 923.
- Findings 923-924 (CLIPPED lacks the hidden-text skip; 903 gate refusal on page-sketch, bisect); 916 built 516b5b8be; 919 Cause. Next free finding: 925.
- 924 Cause: visible-change shots not deterministic (note wrap flips); 903 finishes on the passing gate. Next free finding: 925.
- Finding 925 (pre-push person-names reads the working tree). Next free finding: 926.
