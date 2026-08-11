---
'@ethlete/timetrack': minor
---

Add `collectAgentSessions$()` and the `AgentSessionLogReader` port, which read each agent session log
from a persisted cursor so a run collects only what was appended since the last one.
