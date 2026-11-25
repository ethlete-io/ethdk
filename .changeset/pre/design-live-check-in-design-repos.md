---
'@ethlete/agent-rules': patch
---

`sync` registers the `design-live-check` hook in every repo with `.ethlete/design/config.json`, without the repo listing it in `hooks`. Before, no repo turned it on, so a design agent never got its live findings.
