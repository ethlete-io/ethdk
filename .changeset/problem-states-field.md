---
'@ethlete/cli': minor
---

Design rule findings carry an optional `states` list that the rule baseline ignores. STATE-SENTENCE, DROPPED-PROP, STATE-NO-SOURCE, PAGE-STATE-INNER and render issues fill it; the system listing's `problemStates` reads it, slow-check results included.
