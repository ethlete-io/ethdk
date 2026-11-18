---
status: accepted
open: B611
decided: 2026-11-18
source: proposal of the analysis session (ethlete-sdk-3f) 2026-11-18, approved by the human with "das klingt top", relayed through the doc agent
---

# Progress is shown as a status line and a generated report, not a text dump

The human: "ich hätte auch irgendwie gerne noch eine bessere visualisierung von zb dem was in der nachtschicht erledigt
wurde. im moment ist es ein text dump im chat. weis aber nicht genau was man da machen könnte. cool wäre vielleicht auch
eine status line als claude code mod mit aktuellem task und... vielleicht packen wir da in die details hinter dem slash
command den rest? weis nicht..." And on the first draft: "das sollte aber nicht nur für die nachtschicht gelten das war
nur ein eg".

One data source, three views. A script generates the report from data; the doc agent does not write it as prose. Data:
queue and rows in `plans/`, the git log, the slice file of `yarn slice:paths` (name and start of the running slice),
later the model log (B606).

1. Status line as a mod, always visible in every session: running task with short name, duration, queue length, number
   of open questions to the human, a blocked mark. Example: `▶ Auto-Weg-Modus (B608) · 42 min · 14 offen · ❓2`.
   Pattern: the e2e-progress mod in `libs/agent-rules/content/mods`. Needs the short names (B609).
2. Report on return: when the human types again after a pause, they get three lines, the link to the page and the
   collected questions. The page covers the time they were away (timestamps of the away mode, B608), 40 minutes or a
   night alike. Below a threshold (start value: fewer than two finished rows) no page, only the lines in chat.
3. Page content: finished rows with short name, commit and one sentence on the result, a screenshot for UI rows; parked
   rows with reason; numbers (commits, red CI, usage); open questions. The questions also stand in chat, where the
   human answers.
4. Report on demand: a slash command builds the same page for a chosen period (today, since yesterday, this week). The
   pane with the live state (queue head, running slice, last finished rows) hangs on the same command.
5. The same for all sessions: doc agent, builder and consumers use the same script and mod, shipped through the package
   as in ADR 0374. Built package-ready.
6. Order: report on demand first (needs only git log and rows), then the status line after B609, then the report on
   return after B608, the pane last.
7. Look of page and status line: the builder builds its recommendation and shows it finished; no picks for the human.

Open, not decided by the human: where the page lives. Proposal of the analysis session: a published private page for
Studio and SDK (readable from another device), a local HTML file for Timetrack and fifagg because customer names appear
there. The human did not object but did not agree explicitly either. The doc agent asks before the builder needs it.
