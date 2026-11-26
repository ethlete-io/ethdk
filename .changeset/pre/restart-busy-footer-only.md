---
'@ethlete/agent-rules': patch
---

Fix `agent-sessions restart` never restarting an idle session whose own chat text said "Waiting for": only the spinner line and the footer count as busy.
