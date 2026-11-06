<!-- Session state of the grill/docs agent. Delete once resumed. -->

# Handoff: grill/docs session (doc-agent), 2026-11-06 evening

I am ethlete-sdk-c4 (tmux claude2-2). Builder = ethlete-sdk-c0 (tmux claude2). fifagg SDK session = ethlete-sdk-62
(tmux claude2-3), section 12 of plans/et-update-findings.md is closed (db01f3653), it may be idle now. Mac perf session
in tmux `mac-perf@ethlete-sdk` (not in ListAgents; answer by `tmux send-keys -t mac-perf@ethlete-sdk -l '<text>'` +
Enter): told to push+reset before every measurement and name the measured sha; no report from it yet.

**Tom is afk.** Collect questions, one short German line per event. Last finding 529, last ADR 0214.

## Collected for Tom (ask when he is back, grill round format)

- Push/release of `next` so fifagg can use the section 12 fixes? ADR 0213 parked the push; ~217+ commits unpushed.
  Recommendation: push after S7 closes the perf block, unless fifagg needs it sooner (then push now, CI green first).

## Perf block (ADR 0213) state - all in design-to-code.md after finding 523, findings 524-529

Compare target met, also after an edit (typical app edit 5.77 s, design 4.8-5.2 s, next run ~1 s). c0 order now:
open-points tracked key (record every file the rules read, not a folder fingerprint) + revision guard (every shot-store
write bumps the revision Studio sees; e2e: edit outside redraw events -> next switch shows new picture) -> Studio frame
C (ADR 0186 in the sketch view, scroll e2e) -> 528 draw-count invariant -> S7 (full check <= 60 s) -> S8, S5. A c0
subagent is verifying slice A (e2e rerun, design check, switch times) and building 523's page-switch time in timings.
Deferred: cut 2 (reuse design shots when markup+styles match) after C; 527 lint (constant import pulls a command
module) after the perf block.

## Loose ends

- On each c0 report: record as-built in design-to-code.md (after the last paragraph, finding 529), commit plan files
  only, no trailers.
- Queued outside perf: pages/sketches DIFF on every state; 514/518 slice, title-bar notice states, 511/512, B412, B406,
  B407, B410, B413-B415; pages/start accept by Tom (after shell-main).
