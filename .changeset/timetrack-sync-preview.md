---
'@ethlete/timetrack': minor
---

Add the read-only half of a Tempo sync — `previewTempoSync$` resolves the account, the issue ids and
the day's remote worklogs into a `TempoSyncPlan`, and `fetchJiraMyself$` reads the account id every
Tempo call is scoped to.
