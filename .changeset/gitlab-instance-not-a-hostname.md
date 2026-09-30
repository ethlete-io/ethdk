---
'@ethlete/timetrack': patch
'timetrack-app': patch
---

An email address or a git remote in the GitLab instance field is named as not a hostname, instead of offered as the host of a `glab auth login` command. Adds `isForgeHostname`.
