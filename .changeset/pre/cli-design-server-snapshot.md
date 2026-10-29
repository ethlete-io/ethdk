---
'@ethlete/cli': patch
---

`et design` copies its own code and frame assets into a per-process folder at start and serves them from there, so rebuilding or reinstalling the cli no longer changes what a running design server serves or renders.
