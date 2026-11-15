---
status: accepted
built: 911618cc7
decided: 2026-11-15
source: doc-agent session 2026-11-15, evening, Q2 of the open round
---

# A pure port keeps the ready judgement

When the product under a ready sketch changes, the builder ports the sketch onto it with its look unchanged. `sketch
ready` then refuses ("changed since sketch ready judged it - add --reopen if the user asked"); this hit
pages/sketches@merge-error and @pending-fold. Asked whether the tool learns the case, the builder may use `--reopen`
after every port, or the human is asked each time, with the recommendation of the tool fix, the human answered "a".

`sketch rebase --ported` refreshes the sketch's ready content itself, so a pure port stays ready without `--reopen`.
`--reopen` stays reserved for a look change the human asked for.
