---
'@ethlete/cli': patch
---

`et design check --slow` now compares a part whose design changed after it was implemented, and fails a state the app has no element to drive, naming the app component to build.
