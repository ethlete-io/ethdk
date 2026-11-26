---
'@ethlete/timetrack': minor
---

`searchJiraIssues$` errors instead of returning a truncated result past `maxPages`; the new `searchJiraTopIssues$` reads the first `limit` issues of a query.
