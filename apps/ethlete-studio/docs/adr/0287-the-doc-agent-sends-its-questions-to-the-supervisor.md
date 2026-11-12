---
status: accepted
built: c47a23b35
decided: 2026-11-12
source: chat with the doc agent 2026-11-12, about 13:05 local
---

# The doc agent sends its questions to the supervisor

The doc agent put a grill round on the push workflow to the human in chat. The human said (German, verbatim):

> bitte schicke deine fragen an den supervisor stehts

- From now on the doc agent sends its questions to the supervisor, the analysis session (claude2), not to the human in
  chat.
- The supervisor answers or takes the question to the human. The doc agent records the human's own words where the
  supervisor gives them, and names a relayed text as such.
- In effect since the decision; `built` names HEAD at that time (c47a23b35), because no code change builds it.
