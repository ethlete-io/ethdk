---
'@ethlete/timetrack': patch
---

`agentApiClientOf` also drops Unicode format characters, such as a bidi override, so a caller's name cannot read as something else in the approval panel.
