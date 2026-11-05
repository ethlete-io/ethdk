---
'@ethlete/cli': patch
---

The render rules that walk controls (`CUT-CONTROL`, `SKIP-SCOPE`, `UNREACHABLE`) share one reachable-controls helper, so they agree on inert, hidden and `display: none` subtrees.
