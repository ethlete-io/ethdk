---
'@ethlete/timetrack': patch
---

Build a heavy day's rows about four times faster: `streamDay` no longer copies its event list once per event when it groups the events by machine, and `repoRootOf` remembers the checkout it found for a path.
