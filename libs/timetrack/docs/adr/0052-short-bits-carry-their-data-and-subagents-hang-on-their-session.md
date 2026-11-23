---
open: B602
decided: 2026-11-19
---

# Short bits carry their data, and subagents hang on their session

On 18.11. short blocks under 30 min showed only "unattributed activity", and nothing showed that subagents worked
alongside a session. On cutting an unattended band at a peer's window the human said: "ok aber das ist ein workaround.
wir sollten auch die wurzel angehen. schnipsel okay aber die sollten dann auch passende daten haben. zudem sieht man
noch überhaput gar nicht das paralele arbeiten. hier laufen ja andauernd sub agents die ggf andere arbeiten machen".
On drawing subagents as own stripes: "ja aber kommt auch drauf an ein wenig. sub agents sind ggf nochmal etwas eigenes
vs zb. 2 echte sessions die paralel arbeiten". The human confirmed the summary below with "ok".

- A short bit stays its own block, but it names what happened in it, from the events that made it. A block without
  content is fixed at its source, not by relabelling or folding it into a neighbour.
- A subagent is its own kind of work, not a second session. Two real parallel sessions stay equal rows side by side
  (ADR 0043). A subagent hangs visibly on its parent session: an own stripe from 15 min of run time, shorter ones only
  as a detail of the session's row. Its task is its description.
- Tempo still gets the wall clock once: a subagent never adds bookable time.
- A subagent's time is attended only as its session's is: working while nobody is there stays unattended (ADR 0018).
- How a subagent stripe and a parallel session differ in the picture is not a question for the human: offered a pick
  between three sketch variants, the human answered "design frage agent violation". The builder builds its own pick, thin
  stripes inside the parent session's lane.
