---
status: accepted
built: 37de33e8d
decided: 2026-11-18
source: proposal of the analysis session (ethlete-sdk-3f) 2026-11-18, approved by the human, relayed through the doc agent
---

# Sonnet subagents are measured per model before a risk guard

The human asked: "und zudem wie sorgen wir dafür dass wir durch sonnet nun keinen minderwertigen code vs opus
produzieren?" On the four points below he said: "klingt gut, online in benchmarks zeigte sich steht der unterschied ist
aktuell bei sonnet 5.5 vs opus5.5 nicht wikrlich hoch im preis. check das gegen. punkte weitergeben".

1. The `subagent-model-policy.py` hook logs model, task and files of each subagent start to a local log that can be
   joined with git (B606).
2. The re-measurement B605 reports per model: rework (share of commits followed within 48 h by a fix on the same files),
   escalation (a sonnet task handed to opus or redone by the parent), red CI runs caused by the change, and cost per
   finished subagent task.
3. Guard by risk, not by model: sonnet writes, opus reviews the diff, only on sensitive paths (public API of the libs,
   Timetrack row logic, release and CI). Decided from the B605 numbers, not started now.
4. A task class that escalates or needs rework clearly more often on sonnet moves to the opus row of the model table.
   The threshold is set after the first measurement.

Price check (list prices cached 2026-11-03, per 1M tokens): Sonnet 5.5 $2 in, $10 out, $0.10 cache read; Opus 5.5 $4,
$20, $0.20. Opus costs twice as much on every line; at the measured volume about $630 per 8 days less on sonnet
(estimate, same token counts assumed). Whether sonnet needs more turns per finished task is what point 2 measures.

Public benchmarks (checked 2026-11-18, secondary sources citing Artificial Analysis) agree with the human's doubt at
the top effort: at max effort Sonnet 5.5 wrote about 60 % more output tokens per task and cost more per task than Opus
5.5 ($7.60 vs $5.98); at default or medium effort it was clearly cheaper per solved task. So the log in point 1 also
records the effort level, and B605 compares cost per finished task per model and effort.

The human added: "wir reden hier übrigens nicht von ersparniss in doller da das hier ne claude sub ist. eher in
usage limits". The dollar figures above only show the ratio; B605 measures usage (tokens per finished task, weighted
by model) against the subscription limits, not money.

Points 3 and 4 wait for B605; the order "build 1 and 2 now" is the analysis session's proposal, applied by the doc agent.
