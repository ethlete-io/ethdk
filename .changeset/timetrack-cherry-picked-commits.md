---
'@ethlete/timetrack': patch
'timetrack-app': patch
---

Count a commit once per day: the git scan stores each commit's `git patch-id --stable`, and the day drops a later copy with the same sha, patch id, or author time and subject (cherry-pick, rebase, amend).
