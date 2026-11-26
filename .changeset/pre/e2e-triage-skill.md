---
'@ethlete/agent-rules': minor
---

Add the consumer skill `e2e-triage`: read the failures file of the `@ethlete/cli` failure reporter, group the failures by error, fix the largest group first, and re-run only the failed spec files.
