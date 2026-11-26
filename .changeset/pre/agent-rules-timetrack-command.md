---
'@ethlete/agent-rules': minor
---

`ethlete-agents timetrack` reaches Jira through the running Timetrack app, so no repository holds a
token any more — the `jira` credentials in the local config and the `JIRA_*` variables are gone.
