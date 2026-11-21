---
'@ethlete/cli': patch
---

`design check` stores only passing slow-check results. A failed APP-SPEC, UNCOVERED-REGION, compare or action result reruns on the next check instead of replaying until the inputs change, so one flaky failure no longer blocks a part.
