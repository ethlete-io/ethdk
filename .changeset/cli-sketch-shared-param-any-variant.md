---
'@ethlete/cli': patch
---

The sketch check reports a parameter of a `shared/` function as unused only when no call in any variant passes it. A parameter that only some variants pass no longer reports.
