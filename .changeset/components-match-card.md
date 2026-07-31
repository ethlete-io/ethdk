---
'@ethlete/components': minor
---

Add the match domain behind `MATCH_CARD_IMPORTS`: `<et-match-card>` (one card, three container-query layouts —
dense row, featured card, wide row; `size` pins one; put it on an `<a>` to make the whole card the link),
`<et-match-participant>`, the headless `etMatchCard` directive with its score/meta/game-score parts,
`provideMatchLabels()`, and `normalizeEthleteMatch()` — cards take a `NormalizedMatch`, so any backend maps in
with a plain adapter.
