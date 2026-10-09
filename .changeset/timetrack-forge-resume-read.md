---
'@ethlete/timetrack': patch
'timetrack-app': patch
---

The GitLab and GitHub collectors resume a day before their newest stored event instead of re-reading a month after every restart, and report a cap only when it cuts off what the store does not hold.
