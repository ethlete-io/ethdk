---
'@ethlete/cli': patch
---

Keep the design server answering while it lists many sketches: each sketch now starts in its own event-loop turn instead of all in one.
