---
status: accepted
open: B688
decided: 2026-11-23
source: doc-agent session 2026-11-23, workflow review round (Q1-Q4)
---

# One queue file and one process page replace the process pile

A review of the agent workflow found that most of what grew around the two sessions protects the process, not the
product: about 60 process ADRs (some contradict each other), six plan files with hourly folds, and hooks that warn
falsely. The human answered: "q1 nein. das kostet zu viel zeit auf keinen fall müllen wir die pre commit hooks wieder
voll das thema ist auch WIEDERHOLUNG. q2ok q3ok q4 sie sind nicht privat. nur nicht auf npm. was ist das für eine müll
frage".

1. **One queue file** of at most 15 rows replaces STATUS, queue, rows, lists, the machinery pile, the parked suspects
   and the collect file with its hourly fold. The machinery pile and the parked suspects are dropped.
2. **One process page** of about 40 lines replaces the process ADRs; they become superseded and `adr:governs` no longer
   lists them. The two role skills shrink to about 30 lines each. Hooks that only add ceremony or warn falsely go.
   A new process rule must delete an old one. The human reads the page before anything is deleted.
3. **No smoke run before a push or commit.** ADR 0033 (no e2e in pre-push) stands; the question repeated it.
4. The apps are not private packages, only not on npm: their changesets stay (no question again).
