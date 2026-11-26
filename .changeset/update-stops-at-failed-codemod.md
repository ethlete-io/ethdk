---
'@ethlete/cli': minor
---

`et update` stops at a failed codemod: the codemods after it stay unrun, the output names the failed step and each `file:line` the generator reported, and `--continue` resumes at the failed step.
