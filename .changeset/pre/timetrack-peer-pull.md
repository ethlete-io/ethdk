---
'timetrack-app': patch
---

A paired machine now pulls the other machine's own events after each heartbeat and keeps them apart from its own, and deletions on the other machine reach the copy. The agent op `peers.pull` runs one pull on demand.
