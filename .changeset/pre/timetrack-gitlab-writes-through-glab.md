---
'timetrack-app': minor
'@ethlete/timetrack': minor
---

Timetrack opens and changes GitLab merge requests through the `glab` login, and deletes the stored GitLab token on start. Removes `GitLabCredentials`, `readGitLabCredentials$`, `gitlabRequest$`, `gitlabPaged$` and `normalizeGitLabHost`.
