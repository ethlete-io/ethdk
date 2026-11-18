---
status: accepted
built: ecc45f8c2
decided: 2026-11-18
source: proposal of the analysis session (ethlete-sdk-3f) 2026-11-18, approved by the human with "das klingt top", relayed through the doc agent
---

# Progress is shown as a status line and a generated table, not a text dump

The human: "ich hätte auch irgendwie gerne noch eine bessere visualisierung von zb dem was in der nachtschicht erledigt
wurde. im moment ist es ein text dump im chat. weis aber nicht genau was man da machen könnte. cool wäre vielleicht auch
eine status line als claude code mod mit aktuellem task und... vielleicht packen wir da in die details hinter dem slash
command den rest? weis nicht..." And on the first draft: "das sollte aber nicht nur für die nachtschicht gelten das war
nur ein eg".

One data source, two views. A script generates the report from data; the doc agent does not write it as prose. Data:
queue and rows in `plans/`, the git log, the slice file of `yarn slice:paths` (name and start of the running slice),
later the model log (B606).

1. Status line as a mod, always visible in every session: running task with short name, duration, queue length, number
   of open questions to the human, a blocked mark. Example: `▶ Auto-Weg-Modus (B608) · 42 min · 14 offen · ❓2`.
   Pattern: the e2e-progress mod in `libs/agent-rules/content/mods`. Needs the short names (B609).
2. No page. Asked where a report page should live, the human: "weder noch. das finde ich unnötig". Asked what stays
   without a page, the human chose: status line plus a script-generated fixed table in chat; no live pane.
3. Table content: one line per finished row with short name, commit and one sentence on the result; parked rows with
   reason; numbers (commits, red CI, usage). Open questions follow the table in chat.
4. Report on demand: a slash command prints the table for a chosen period (today, since yesterday, this week).
5. Report on return: when the human types again after a pause, the same table covers the time they were away
   (timestamps of the away mode, B608), 40 minutes or a night alike, followed by the collected questions.
6. The same for all sessions: doc agent, builder and consumers use the same script and mod, shipped through the package
   as in ADR 0374. Built package-ready.
7. Order: report on demand first (B611, needs only git log and rows), then the status line (B612, after B609), then the
   report on return (B613, after B611 and B608).
8. Look of table and status line: the builder builds its recommendation and shows it finished; no picks for the human.
