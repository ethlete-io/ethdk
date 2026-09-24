---
'timetrack-app': patch
'@ethlete/agent-rules': patch
---

A 15-minute row nobody was at the machine for now folds into the row of the same name it touches, and
two such rows side by side join into one. The day's total does not change. `timetrack rows --json`
now says which rows are `unattended`.
