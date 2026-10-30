---
'@ethlete/agent-rules': patch
---

The handoff skill now keeps the restart reason in the handoff file, because the `/clear` of a self-restart wipes the old pane. Its restart command now uses the installed skill name, `ethlete-handoff`, instead of `/handoff`.
