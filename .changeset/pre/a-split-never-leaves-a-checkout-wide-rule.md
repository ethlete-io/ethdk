---
'@ethlete/timetrack': patch
'@ethlete/agent-rules': patch
---

Splitting a checkout-wide placeholder no longer refuses over a day with no commit. It always
removes the record and its checkout-wide rule, so later branches can get records of their own.
