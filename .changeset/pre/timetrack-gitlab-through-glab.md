---
'@ethlete/timetrack': minor
---

GitLab activity is read through `glab`, which holds its own login, so the app stores no token to
collect. A source now reports "not installed" and "not logged in" as two distinct states.
