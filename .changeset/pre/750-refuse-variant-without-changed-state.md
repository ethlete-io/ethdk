---
'@ethlete/cli': patch
---

`sketch ready` refuses and `sketch check` warns (`NO-CHANGED-STATE`) on a variant that draws no changed state, the Studio listing shows it as a problem, and `--no-visible-change` keeps the automatic merge of a sketch meant to change no pixel.
