---
status: accepted
built: 581d2b584
decided: 2026-11-09
source: doc-agent session 2026-11-09, question on the "3 ungepusht · 0,7 h" warning
---

# The builder pushes each finished slice after the full suite

The human, on three local commits that waited 0.7 h for the end of a batch: "wieso eig diese batches hier? wir hatten
doch beschlossen dass eig kein fehlerhafter kram erst die ci erreichen soll. und ungepusht?" To push after each
finished slice instead of per batch: "ok".

- The builder pushes at the end of each finished slice, as ADR 0230 says, not after a batch of slices.
- Before each push, the full suite (`nx test cli`, `yarn studio:e2e`) runs in the background while the next slice
  starts. A red result stops the push, as before.
