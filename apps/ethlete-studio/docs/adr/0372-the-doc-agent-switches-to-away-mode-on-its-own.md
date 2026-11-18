---
status: accepted
open: B608
decided: 2026-11-18
source: proposal of the analysis session (ethlete-sdk-3f) 2026-11-18, approved by the human with "das klingt prima", relayed through the doc agent
---

# The doc agent switches to away mode on its own

The human: "wir sollten denke ich auch übr einen auto afk modus nachdenken. oder ggf in kombi was mit timetrack. in
nicht afk wiederholt der doc ja seine fragen bei jedem turn. manchmal vergesse ich aber afk zu schreiben. zudem schreibt
doc viel mehr text in nicht afk mode".

1. Signal: a hook writes a timestamp on every input the human types in the doc session. Mailbox lines ("Mailbox message
   from ..."), cross-session messages and restart prompts do not count.
2. Away on its own: when the timestamp is older than the threshold, the doc agent gets "the user is away" injected on its
   next turn and works by the existing "When the user is away" rules (collect, one line per event, no round).
3. Back on its own: the next typed input of the human in the doc session switches back; the doc agent puts every
   collected question once, in full, in the round format.
4. A question that stays open is shown once when it comes up and once on return, not in every turn. The purpose stays: no
   question gets lost under a status line. The doc-agent skill line "Repeat it in full, in its own message" changes to
   match (in `libs/agent-rules/content`, then sync).
5. Unchanged: "afk" still switches at once; the night shift counts as away (ADR 0259); the sound on a blocking question
   stays.
6. Not the machine's idle time as the signal: the human sometimes follows from another device, and sometimes works at the
   machine without reading the doc chat.
7. Timetrack is not part of this step (later maybe: calendar "in a meeting until X", the timestamps as presence evidence
   for Timetrack). No row until the human asks.

Threshold 15 minutes as start value: set by the analysis session, not by the human, an estimate. B605 checks it from
the transcripts (time from question to answer, doc agent text volume in pauses).
