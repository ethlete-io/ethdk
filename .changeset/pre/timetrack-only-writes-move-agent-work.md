---
'@ethlete/timetrack': patch
'timetrack-app': patch
---

Agent session work moves to another checkout only when the session writes there: a file edit, or a
command that does more than read. Reading or searching another repository leaves the time where it is.
