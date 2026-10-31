---
'@ethlete/cli': patch
---

`et design complete` reports `CONTROL-UNDECLARED` as a hint; the sketch check fails on a control a sketch adds. For a native control the hint says to mark it with `control(markup, name)` and declare the name in `controls`.
