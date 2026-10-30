---
'@ethlete/agent-rules': patch
---

`agent-sessions restart` now waits until the session ended its turn and its prompt is empty, so it no longer types into a running turn or into your draft.
