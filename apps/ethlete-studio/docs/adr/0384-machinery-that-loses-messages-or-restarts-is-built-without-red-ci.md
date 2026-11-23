---
status: superseded by 0424
built: d8e9cd613
decided: 2026-11-20
source: doc-agent session 2026-11-20, the human on the dead mailbox dispatcher and a fifagg restart stuck behind a background agent
---

# Machinery that loses messages or restarts is built without red CI

The machinery pile is built only on red CI (ADR 0285). Two defects never turn CI red but lost work on 2026-11-20: the
dispatcher of this checkout was not running, so four fifagg SDK batches sat unread for over an hour; and a restart's
`/clear` left background agents running, whose report started a turn in the cleared fifagg session while its resume
prompt sat queued. The human asked (German, verbatim): "du hast die mailbox nicht mehr an???" and "das passiert auch
gerne mal beim auto handoff und resume. vor dem handoff kommt schon eine message rein oder sowas". Asked whether to build
these despite green CI, the human answered "q1ok" to the recommendation: build them as one builder row.

A machinery defect that loses a message or a restart is built without red CI; every other machinery defect stays on the
pile.
